self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())

// No fetch interception — all requests go straight to the network.
// This keeps SSE connections and API calls working normally while
// still satisfying the browser's service-worker requirement for
// PWA installability.
