
const WebSocket = require('ws');
const AbletonLink = require('abletonlink');

const link = new AbletonLink({
    quantum: 4,
    debug: true
});
const wss = new WebSocket.Server({ port: 8765 });

let transportRunning = false;

// Funkcja do obliczania aktualnej pozycji w takcie
function calculatePosition(rawBeat) {
    // Pobierz quantum (domyślnie 4 beaty na takt)
    const quantum = link.getQuantum();
    
    // Oblicz numer taktu (zaczynając od 1)
    const bar = Math.floor(rawBeat / quantum) + 1;

    // Oblicz beat w takcie (1-quantum)
    const beatInBar = (Math.floor(rawBeat) % quantum) + 1;

    // Oblicz phase (część ułamkowa beatu)
    const phase = rawBeat % 1;

    return {
        bar,
        beat: beatInBar,
        phase,
        rawBeat,
        quantum
    };
}

function getCurrentState() {
    // Pobierz aktualny beat i phase
    const rawBeat = link.getBeat();
    const phase = link.getPhase();
    const position = calculatePosition(rawBeat);
    
    // Upewnij się, że mamy aktualny stan transportu
    const isPlaying = link.getIsPlaying();
    
    // Aktualizuj globalną zmienną transportRunning
    transportRunning = isPlaying;

    // Debug log
    console.log('Link state:', {
        rawBeat,
        phase,
        position,
        tempo: link.getBpm(),
        isPlaying: isPlaying,
        numPeers: link.getNumPeers()
    });

    return {
        position: `${position.bar}.${position.beat}`,
        bpm: Math.round(link.getBpm()),
        is_downbeat: position.beat === 1,
        transport_running: isPlaying,
        timestamp: Date.now() / 1000,
        phase: position.phase,  // Dodajemy phase do głównych danych
        quantum: position.quantum,  // Dodajemy quantum do głównych danych
        debug: {
            tempo: link.getBpm(),
            rawBeat: rawBeat,
            phase: position.phase,
            quantum: position.quantum,
            numPeers: link.getNumPeers(),
            position: position
        }
    };
}

// Aktualizuj stan co 20ms (50Hz)
function startLinkUpdates() {
    return setInterval(() => {
        // Wymuszamy aktualizację stanu Link
        link.update();
        
        // Pobierz aktualny stan
        const state = getCurrentState();
        
        // Wyślij stan do wszystkich podłączonych klientów
        let clientCount = 0;
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify(state));
                    clientCount++;
                } catch (error) {
                    console.error('Błąd wysyłania stanu:', error);
                }
            }
        });
        
        // Co 50 aktualizacji (około 1 sekunda) wyświetl informację o liczbie klientów
        // Pomaga w debugowaniu, ale nie zaśmieca konsoli
        if (Math.random() < 0.02) {  // ~2% szans na wyświetlenie (co ~1 sekundę)
            console.log(`Aktywnych klientów: ${clientCount}, Peers: ${link.getNumPeers()}, Tempo: ${link.getBpm()}, Transport: ${link.getIsPlaying()}`);
        }
    }, 20);  // 50Hz - dobry kompromis między responsywnością a obciążeniem
}

let updateInterval = startLinkUpdates();

wss.on('connection', (ws) => {
    console.log('Nowy klient połączony');

    try {
        ws.send(JSON.stringify(getCurrentState()));
    } catch (error) {
        console.error('Błąd wysyłania początkowego stanu:', error);
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            switch(data.type) {
                case 'start':
                    link.setIsPlaying(true);
                    console.log('Transport uruchomiony');
                    break;

                case 'stop':
                    link.setIsPlaying(false);
                    console.log('Transport zatrzymany');
                    break;

                case 'set_tempo':
                    if (data.bpm) {
                        const newTempo = parseFloat(data.bpm);
                        if (newTempo >= 20 && newTempo <= 300) {
                            link.setBpm(newTempo);
                            console.log('Ustawiono tempo:', newTempo);
                        }
                    }
                    break;
            }
        } catch (e) {
            console.error('Błąd przetwarzania wiadomości:', e);
        }
    });
});

// Nasłuchiwanie na zmiany
link.on('tempoChanged', (tempo) => {
    console.log('Zmiana tempa:', tempo);
    // Natychmiast wyślij aktualizację do klientów po zmianie tempa
    const state = getCurrentState();
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(state));
            } catch (error) {
                console.error('Błąd wysyłania stanu po zmianie tempa:', error);
            }
        }
    });
});

link.on('numPeersChanged', (peers) => {
    console.log('Zmiana liczby peers:', peers);
    // Możemy wysłać aktualizację, aby klient wiedział o zmianie liczby peers
    const state = getCurrentState();
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(state));
            } catch (error) {
                console.error('Błąd wysyłania stanu po zmianie liczby peers:', error);
            }
        }
    });
});

link.on('playStateChanged', (isPlaying) => {
    console.log('Zmiana stanu odtwarzania:', isPlaying);
    transportRunning = isPlaying;
    
    // Natychmiast wyślij aktualizację do klientów po zmianie stanu odtwarzania
    const state = getCurrentState();
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(state));
            } catch (error) {
                console.error('Błąd wysyłania stanu po zmianie stanu odtwarzania:', error);
            }
        }
    });
});

process.on('SIGINT', () => {
    console.log('\nZamykanie serwera...');
    clearInterval(updateInterval);
    link.stopUpdate();
    link.disable();
    wss.close(() => {
        process.exit(0);
    });
});

// Włącz Link i rozpocznij aktualizacje
link.enable();
link.startUpdate();
console.log('Serwer uruchomiony na ws://localhost:8765');