import { api } from './api.js';

const DB_NAME = 'tantu-offline-v1';
const STORE = 'queue';
let running = false;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const request = operation(tx.objectStore(STORE));
    tx.oncomplete = () => { database.close(); resolve(request.result); };
    tx.onerror = () => { database.close(); reject(tx.error || request.error); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error('Offline storage transaction was cancelled.')); };
  });
}

export async function pendingItems(userId) {
  if (!userId) return [];
  const items = await transact('readonly', (store) => store.getAll());
  return items.filter((item) => item.userId === userId);
}
export function queueItem(item) {
  if (!item.userId) throw new Error('Sign in before saving an offline draft.');
  return transact('readwrite', (store) => store.put({ ...item, status: 'pending', updatedAt: Date.now() }));
}
export function removeItem(key) { return transact('readwrite', (store) => store.delete(key)); }

export async function flushQueue(userId, onChange = () => {}, isCurrentUser = () => true) {
  if (running || !navigator.onLine || !userId) return;
  running = true;
  try {
    for (const item of await pendingItems(userId)) {
      if (!isCurrentUser()) break;
      try {
        await api(item.path, { method: item.method, body: item.payload });
        await removeItem(item.key);
        onChange();
      } catch (error) {
        if (error.status === 409) {
          await transact('readwrite', (store) => store.put({ ...item, status: 'conflict', error: error.message }));
          onChange();
        } else if (error.status && error.status < 500) {
          await transact('readwrite', (store) => store.put({ ...item, status: 'needs_attention', error: error.message }));
          onChange();
        } else break;
      }
    }
  } finally { running = false; }
}
