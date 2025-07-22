// Audio Cache Module for Ableton Metrolink
// Handles caching of decoded audio buffers using IndexedDB

const DB_NAME = 'metrolink-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio-buffers';

// Initialize the database
let dbPromise = null;

function openDatabase() {
    if (dbPromise) return dbPromise;
    
    dbPromise = new Promise((resolve, reject) => {
        console.log('Opening IndexedDB database...');
        
        // Check if IndexedDB is supported
        if (!window.indexedDB) {
            console.error('IndexedDB not supported');
            reject(new Error('IndexedDB not supported'));
            return;
        }
        
        // Open the database
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        // Handle database upgrade (first time or version change)
        request.onupgradeneeded = event => {
            console.log('Creating or upgrading IndexedDB database...');
            const db = event.target.result;
            
            // Create object store for audio buffers if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
                console.log('Created audio buffers store');
            }
        };
        
        // Handle success
        request.onsuccess = event => {
            console.log('IndexedDB opened successfully');
            resolve(event.target.result);
        };
        
        // Handle error
        request.onerror = event => {
            console.error('Error opening IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
    
    return dbPromise;
}

// Store a decoded audio buffer in IndexedDB
async function storeAudioBuffer(url, audioBuffer) {
    try {
        // Skip if IndexedDB is not supported
        if (!window.indexedDB) return false;
        
        // Skip if the buffer is invalid
        if (!audioBuffer) return false;
        
        // Open the database
        const db = await openDatabase();
        
        // Serialize the audio buffer
        const serializedBuffer = serializeAudioBuffer(audioBuffer);
        
        // Store the serialized buffer
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Add metadata to help with cache invalidation
            const record = {
                url: url,
                buffer: serializedBuffer,
                timestamp: Date.now(),
                sampleRate: audioBuffer.sampleRate,
                numberOfChannels: audioBuffer.numberOfChannels,
                duration: audioBuffer.duration
            };
            
            const request = store.put(record);
            
            request.onsuccess = () => {
                console.log(`Stored audio buffer for ${url} in IndexedDB`);
                resolve(true);
            };
            
            request.onerror = event => {
                console.error(`Error storing audio buffer for ${url}:`, event.target.error);
                reject(event.target.error);
            };
            
            // Handle transaction completion
            transaction.oncomplete = () => {
                console.log(`Transaction completed for ${url}`);
            };
            
            transaction.onerror = event => {
                console.error(`Transaction error for ${url}:`, event.target.error);
            };
        });
    } catch (error) {
        console.error(`Error in storeAudioBuffer for ${url}:`, error);
        return false;
    }
}

// Get a decoded audio buffer from IndexedDB
async function getAudioBuffer(url, audioContext) {
    try {
        // Skip if IndexedDB is not supported
        if (!window.indexedDB) return null;
        
        // Open the database
        const db = await openDatabase();
        
        // Get the serialized buffer
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(url);
            
            request.onsuccess = event => {
                const record = event.target.result;
                
                if (record) {
                    console.log(`Found cached audio buffer for ${url}`);
                    
                    try {
                        // Deserialize the audio buffer
                        const audioBuffer = deserializeAudioBuffer(record.buffer, audioContext);
                        resolve(audioBuffer);
                    } catch (deserializeError) {
                        console.error(`Error deserializing audio buffer for ${url}:`, deserializeError);
                        resolve(null); // Return null to trigger a fresh load
                    }
                } else {
                    console.log(`No cached audio buffer found for ${url}`);
                    resolve(null);
                }
            };
            
            request.onerror = event => {
                console.error(`Error getting audio buffer for ${url}:`, event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error(`Error in getAudioBuffer for ${url}:`, error);
        return null;
    }
}

// Clear all cached audio buffers
async function clearAudioBufferCache() {
    try {
        // Skip if IndexedDB is not supported
        if (!window.indexedDB) return false;
        
        // Open the database
        const db = await openDatabase();
        
        // Clear the object store
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log('Cleared audio buffer cache');
                resolve(true);
            };
            
            request.onerror = event => {
                console.error('Error clearing audio buffer cache:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('Error in clearAudioBufferCache:', error);
        return false;
    }
}

// Helper function to serialize an AudioBuffer
function serializeAudioBuffer(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = [];
    
    // Extract data from each channel
    for (let i = 0; i < numberOfChannels; i++) {
        channelData.push(audioBuffer.getChannelData(i));
    }
    
    return {
        numberOfChannels,
        length,
        sampleRate,
        channelData
    };
}

// Helper function to deserialize an AudioBuffer
function deserializeAudioBuffer(serializedBuffer, audioContext) {
    const { numberOfChannels, length, sampleRate, channelData } = serializedBuffer;
    
    // Create a new AudioBuffer
    const audioBuffer = audioContext.createBuffer(numberOfChannels, length, sampleRate);
    
    // Fill each channel with the saved data
    for (let i = 0; i < numberOfChannels; i++) {
        const channelDataArray = new Float32Array(channelData[i]);
        audioBuffer.copyToChannel(channelDataArray, i);
    }
    
    return audioBuffer;
}

// Export the functions
window.AudioCache = {
    storeAudioBuffer,
    getAudioBuffer,
    clearAudioBufferCache
};