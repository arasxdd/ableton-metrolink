const WebSocket = require('ws');
const AbletonLink = require('abletonlink');

const link = new AbletonLink();
const wss = new WebSocket.Server({ port: 8765 });

let transportRunning = false;

function getCurrentState() {
    const beat = link.beat;
    const tempo = link.tempo;

    // Obliczanie pozycji w taktach (4/4)
    const bar = Math.floor(beat / 4) + 1;
    const beatInBar = (Math.floor(beat) % 4) + 1;

    return {
        position: `${bar}.${beatInBar}`,
        bpm: Math.round(tempo),
        is_downbeat: beatInBar === 1,
        transport_running: transportRunning,
        timestamp: Date.now() / 1000
    };
}

wss.on('connection', (ws) => {
    console.log('New client connected');

    const intervalId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(getCurrentState()));
        }
    }, 20); // 50Hz update rate

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            switch(data.type) {
                case 'start':
                    transportRunning = true;
                    break;
                case 'stop':
                    transportRunning = false;
                    break;
                case 'set_tempo':
                    if (data.bpm) {
                        link.tempo = parseFloat(data.bpm);
                    }
                    break;
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        clearInterval(intervalId);
        console.log('Client disconnected');
    });
});

console.log('Server running on ws://localhost:8765');