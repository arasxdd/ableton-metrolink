const AbletonLink = require('abletonlink');

// Utworzenie instancji Link z dodatkowymi opcjami diagnostycznymi
const link = new AbletonLink({
    // Możliwe opcje konfiguracji
    bpm: 120,
    quantum: 4,
    numPeers: 0,  // Początkowa liczba połączonych peers
    debug: true   // Włączenie trybu debug jeśli jest dostępny
});

// Funkcja do wyświetlania stanu Link
function printLinkState() {
    console.log('Link Status:');
    console.log('- Enabled:', link.enabled);
    console.log('- Tempo:', link.tempo);
    console.log('- Beat:', link.beat);
    console.log('- Phase:', link.phase);
    console.log('- Quantum:', link.quantum);
    console.log('- Num Peers:', link.numPeers);
    console.log('-------------------');
}

// Włączenie Link
link.enable();
console.log('Link enabled');

// Nasłuchiwanie na zmiany tempa
link.on('tempo', (tempo) => {
    console.log('Tempo changed to:', tempo);
});

// Nasłuchiwanie na zmiany liczby peers
link.on('numPeers', (peers) => {
    console.log('Number of peers changed to:', peers);
});

// Wyświetlaj stan co sekundę
setInterval(printLinkState, 1000);

// Obsługa zakończenia programu
process.on('SIGINT', () => {
    console.log('\nDisabling Link...');
    link.disable();
    process.exit(0);
});