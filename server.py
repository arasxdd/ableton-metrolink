import asyncio
import websockets
import rtmidi
import time
import json
from collections import deque


class MidiHandler:
    def __init__(self):
        self.midi_in = rtmidi.MidiIn()
        self.midi_out = rtmidi.MidiOut()
        self.midi_in.ignore_types(timing=False)
        self.pulse_count = 0
        self.bpm = 120
        self.transport_running = False
        self.port_opened = False
        self.active_connections = set()
        self.last_position = None

        # Współdzielone zmienne dla wszystkich połączeń
        self.clock_times = deque(maxlen=48)  # Bufor na 2 takty
        self.last_clock_time = None
        self.last_bpm_update = 0
        self.bpm_update_lock = asyncio.Lock()

    async def setup_midi(self):
        if not self.port_opened:
            try:
                port_names = self.midi_in.get_ports()
                port_name = next(p for p in port_names if 'loopMIDI' in p)
                idx = port_names.index(port_name)
                self.midi_in.open_port(idx)
                self.midi_out.open_port(idx)
                self.port_opened = True
                print(f"Connected to MIDI port: {port_name}")
            except Exception as e:
                print("MIDI Error:", e)
                raise

    async def update_bpm(self, current_time):
        async with self.bpm_update_lock:
            if not self.clock_times:
                return

            # Oblicz BPM tylko raz na 24 pulsy (jeden beat)
            if self.pulse_count % 24 == 0:
                avg_time = sum(self.clock_times) / len(self.clock_times)
                if avg_time > 0:
                    instant_bpm = 60.0 / (avg_time * 24)
                    if 20 <= instant_bpm <= 300:
                        # Płynniejsze przejście przy małych zmianach
                        if abs(instant_bpm - self.bpm) > 50:
                            self.bpm = instant_bpm
                        else:
                            self.bpm = 0.9 * self.bpm + 0.1 * instant_bpm
                        self.last_bpm_update = current_time

    async def handle_midi(self, websocket):
        self.active_connections.add(websocket)
        try:
            await self.setup_midi()
            last_update = 0
            update_interval = 0.02

            while websocket in self.active_connections:
                current_time = time.time()
                msg = self.midi_in.get_message()

                if msg:
                    message, _ = msg

                    if message[0] == 0xFA:  # Start
                        self.transport_running = True
                        self.pulse_count = 0
                        self.clock_times.clear()
                        self.last_clock_time = current_time
                        await self.broadcast_update(current_time)

                    elif message[0] == 0xFC:  # Stop
                        self.transport_running = False
                        await self.broadcast_update(current_time)

                    elif message[0] == 0xF8 and self.transport_running:  # MIDI Clock
                        self.pulse_count += 1

                        if self.last_clock_time is not None:
                            time_diff = current_time - self.last_clock_time
                            if time_diff > 0:
                                self.clock_times.append(time_diff)

                        self.last_clock_time = current_time
                        await self.update_bpm(current_time)

                        if self.pulse_count % 24 == 0:
                            await self.broadcast_update(current_time)

                elif current_time - last_update >= update_interval:
                    if self.transport_running:
                        await websocket.send(json.dumps(self.get_current_state(current_time)))
                    last_update = current_time

                await asyncio.sleep(0.001)

        except websockets.exceptions.ConnectionClosed:
            print("Client disconnected normally")
        except Exception as e:
            print(f"Handler error: {str(e)}")
        finally:
            self.active_connections.discard(websocket)

    def get_current_state(self, current_time):
        bar = (self.pulse_count // 96) + 1
        beat = ((self.pulse_count % 96) // 24) + 1
        position = f"{bar}.{beat}"

        return {
            "position": position,
            "bpm": round(self.bpm),
            "is_downbeat": (self.pulse_count % 96 == 0),
            "transport_running": self.transport_running,
            "timestamp": current_time
        }

    async def broadcast_update(self, current_time):
        state = self.get_current_state(current_time)
        disconnected = set()

        for ws in self.active_connections:
            try:
                await ws.send(json.dumps(state))
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(ws)
            except Exception as e:
                print(f"Broadcast error: {str(e)}")
                disconnected.add(ws)

        # Usuń rozłączone połączenia
        self.active_connections -= disconnected

    async def receive_commands(self, websocket):
        try:
            async for msg in websocket:
                try:
                    data = json.loads(msg)
                    if data.get("type") == "start":
                        self.midi_out.send_message([0xFA])
                    elif data.get("type") == "stop":
                        self.midi_out.send_message([0xFC])
                except json.JSONDecodeError:
                    continue
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print("Message error:", e)

    def close_ports(self):
        if self.port_opened:
            self.midi_in.close_port()
            self.midi_out.close_port()
            self.port_opened = False


midi_handler = MidiHandler()


async def websocket_handler(websocket):
    print("New WebSocket connection")
    try:
        await asyncio.gather(
            midi_handler.handle_midi(websocket),
            midi_handler.receive_commands(websocket)
        )
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    except Exception as e:
        print("Handler error:", e)


async def main():
    server = await websockets.serve(
        websocket_handler,
        "0.0.0.0",
        8765,
        ping_interval=20,
        ping_timeout=30,
        close_timeout=10
    )
    print("Server ready at ws://0.0.0.0:8765")

    try:
        await asyncio.Future()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.close()
        await server.wait_closed()
        midi_handler.close_ports()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        midi_handler.close_ports()