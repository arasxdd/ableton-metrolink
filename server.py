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
        self.clock_times = deque(maxlen=24)
        self.pulse_count = 0
        self.bpm = 120
        self.transport_running = False
        self.port_opened = False
        self.active_connections = set()

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

    async def handle_midi(self, websocket):
        self.active_connections.add(websocket)
        try:
            await self.setup_midi()

            last_update = 0
            update_interval = 0.05  # 50ms
            clock_count = 0
            last_clock_time = time.time()
            last_position_update = 0

            while websocket in self.active_connections:
                current_time = time.time()
                msg = self.midi_in.get_message()
                
                if msg:
                    message, _ = msg
                    if message[0] == 250:  # Start
                        self.transport_running = True
                        self.pulse_count = 0
                        clock_count = 0
                        last_clock_time = current_time
                        await self.send_update(websocket, current_time)
                        
                    elif message[0] == 252:  # Stop
                        self.transport_running = False
                        await self.send_update(websocket, current_time)
                        
                    elif message[0] == 248 and self.transport_running:  # MIDI Clock
                        self.pulse_count += 1
                        clock_count += 1

                        if clock_count % 24 == 0:
                            now = time.time()
                            time_elapsed = now - last_clock_time
                            last_clock_time = now
                            
                            if time_elapsed > 0:
                                new_bpm = 60 / (time_elapsed / 24)
                                self.bpm = 0.7 * self.bpm + 0.3 * new_bpm

                        if current_time - last_update >= update_interval or \
                           (self.pulse_count % 24 == 0 and current_time - last_position_update >= 0.1):
                            last_position_update = current_time
                            await self.send_update(websocket, current_time)
                            last_update = current_time
                
                await asyncio.sleep(0.001)

        except websockets.exceptions.ConnectionClosed:
            print("Connection closed normally")
        except Exception as e:
            print(f"Handler error: {str(e)}")
        finally:
            self.active_connections.discard(websocket)

    async def send_update(self, websocket, current_time):
        try:
            position = f"{(self.pulse_count // 96) + 1}.{((self.pulse_count % 96) // 24) + 1}"
            await websocket.send(json.dumps({
                "position": position,
                "bpm": round(self.bpm),
                "is_downbeat": (self.pulse_count % 96 == 0),
                "transport_running": self.transport_running,
                "timestamp": current_time
            }))
            print(f"Odebrano MIDI: {self.transport_running}, Pulse count: {self.pulse_count}, Position: {position}")
        except websockets.exceptions.ConnectionClosed:
            raise
        except Exception as e:
            print(f"Send update error: {str(e)}")

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
    async with websockets.serve(
        websocket_handler,
        "0.0.0.0",
        8765,
        ping_interval=20,
        ping_timeout=30,
        close_timeout=10
    ):
        print("Server ready at ws://0.0.0.0:8765")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        midi_handler.close_ports()