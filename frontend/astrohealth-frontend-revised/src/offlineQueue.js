/**
 * IndexedDB is an offline handoff outbox, not a real transmission system.
 * A deliberately small wrapper so a junior developer can trace the flow.
 */
const DB_NAME = "astrohealth-offline-v1";
const STORE_NAME = "handoffs";
const FALLBACK_KEY = "astrohealth-handoffs-fallback-v1";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "reportId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Cannot open IndexedDB"));
  });
}

async function runStore(mode, run) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = run(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => { if (mode === "readonly") resolve(request.result); };
    transaction.oncomplete = () => { if (mode === "readwrite") resolve(true); db.close(); };
    transaction.onerror = () => { reject(transaction.error || new Error("Storage failed")); db.close(); };
    request.onerror = () => { reject(request.error || new Error("Storage failed")); };
  });
}

function readFallback() {
  try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]"); }
  catch { return []; }
}

export async function enqueueHandoff(report) {
  try {
    await runStore("readwrite", (store) => store.put(report));
    return "IndexedDB";
  } catch {
    const existing = readFallback();
    localStorage.setItem(FALLBACK_KEY, JSON.stringify([...existing, report]));
    return "localStorage fallback";
  }
}

export async function getQueuedHandoffs() {
  try {
    const rows = await runStore("readonly", (store) => store.getAll());
    return [...rows, ...readFallback()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return readFallback().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
