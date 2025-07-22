// Service Worker for Ableton Metrolink
const CACHE_NAME = 'metrolink-cache-v1';
const SOUND_CACHE_NAME = 'metrolink-sounds-v1';

// Assets to cache immediately on service worker installation
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css'
];

// Sound files to cache
const SOUND_FILES = [
  '/sounds/click1_high.wav',
  '/sounds/click1_low.wav',
  '/sounds/click2_high.wav',
  '/sounds/click2_low.wav',
  '/sounds/click3_high.wav',
  '/sounds/click3_low.wav'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing Service Worker...');
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  
  event.waitUntil(
    // Cache core assets
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching core app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        // Cache sound files separately with special settings
        return caches.open(SOUND_CACHE_NAME)
          .then(soundCache => {
            console.log('[Service Worker] Caching sound files');
            
            // Use custom fetch options for sound files to ensure proper caching
            const soundPromises = SOUND_FILES.map(soundFile => {
              return fetch(soundFile, {
                // Cache-control headers are set by the server, but we can add additional options here
                cache: 'force-cache' // Try to force using the cache
              })
              .then(response => {
                // Clone the response before caching it
                const responseToCache = response.clone();
                
                // Cache the response
                return soundCache.put(soundFile, responseToCache)
                  .then(() => {
                    console.log(`[Service Worker] Cached sound file: ${soundFile}`);
                    return response;
                  });
              })
              .catch(error => {
                console.error(`[Service Worker] Failed to cache sound file ${soundFile}:`, error);
              });
            });
            
            return Promise.all(soundPromises);
          });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating Service Worker...');
  
  // Claim clients to ensure the service worker controls all pages immediately
  self.clients.claim();
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete any cache that doesn't match our current cache names
            if (cacheName !== CACHE_NAME && cacheName !== SOUND_CACHE_NAME) {
              console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
  );
});

// Fetch event - serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Special handling for sound files
  if (SOUND_FILES.some(soundFile => url.pathname.endsWith(soundFile))) {
    event.respondWith(fetchSoundFile(event.request));
    return;
  }
  
  // Standard cache-first strategy for other assets
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Don't cache non-GET requests or failed responses
            if (event.request.method !== 'GET' || !networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Clone the response before returning it
            const responseToCache = networkResponse.clone();
            
            // Cache the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          });
      })
      .catch(error => {
        console.error('[Service Worker] Fetch error:', error);
        // Could return a fallback response here if needed
      })
  );
});

// Special function to handle sound file fetching
function fetchSoundFile(request) {
  // Try to get from sound cache first
  return caches.open(SOUND_CACHE_NAME)
    .then(cache => {
      return cache.match(request)
        .then(cachedResponse => {
          // If found in cache and not expired, return it
          if (cachedResponse) {
            console.log(`[Service Worker] Serving sound file from cache: ${request.url}`);
            return cachedResponse;
          }
          
          // Otherwise fetch from network with cache headers
          console.log(`[Service Worker] Fetching sound file from network: ${request.url}`);
          return fetch(request, {
            cache: 'force-cache' // Try to force using the cache
          })
          .then(networkResponse => {
            // Clone the response before caching it
            const responseToCache = networkResponse.clone();
            
            // Cache the new response
            cache.put(request, responseToCache);
            
            return networkResponse;
          });
        });
    });
}