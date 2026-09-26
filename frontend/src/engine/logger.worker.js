// Buffers trial records off the main thread; mirrors into IndexedDB as a backup
// in case upload fails or the tab is killed before flush.
let buffer = []
let db = null

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('bnb-codyssey-trials', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('trials', { keyPath: 'trialIndex' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function mirror(record) {
  db ??= await openDb()
  db.transaction('trials', 'readwrite').objectStore('trials').put(record)
}

self.onmessage = async (event) => {
  const { type, payload } = event.data

  if (type === 'log') {
    buffer.push(payload)
    mirror(payload).catch(() => {}) // best-effort backup, never blocks logging
  }

  if (type === 'flush') {
    const batch = buffer
    buffer = []
    self.postMessage({ type: 'flushed', payload: batch })
  }
}
