const DB_NAME = 'CryptoCommandCenter';
const DB_VERSION = 1;

export interface LogEntry {
  id?: number;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface SessionData {
  id: string;
  virtualBalance: number;
  lastUpdate: string;
  totalScanned: number;
  opportunities: number;
}

let db: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains('logs')) {
        const logStore = database.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!database.objectStoreNames.contains('session')) {
        database.createObjectStore('session', { keyPath: 'id' });
      }
    };
  });
};

export const addLog = async (log: Omit<LogEntry, 'id'>): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['logs'], 'readwrite');
    const store = transaction.objectStore('logs');
    const request = store.add(log);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getLogs = async (limit = 100): Promise<LogEntry[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['logs'], 'readonly');
    const store = transaction.objectStore('logs');
    const request = store.getAll();
    request.onsuccess = () => {
      const logs = request.result as LogEntry[];
      resolve(logs.slice(-limit));
    };
    request.onerror = () => reject(request.error);
  });
};

export const clearLogs = async (): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['logs'], 'readwrite');
    const store = transaction.objectStore('logs');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const saveSession = async (session: SessionData): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['session'], 'readwrite');
    const store = transaction.objectStore('session');
    const request = store.put(session);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getSession = async (): Promise<SessionData | null> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['session'], 'readonly');
    const store = transaction.objectStore('session');
    const request = store.get('main');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const clearSession = async (): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['session'], 'readwrite');
    const store = transaction.objectStore('session');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const fullSystemReset = async (): Promise<void> => {
  await clearLogs();
  await clearSession();
  localStorage.clear();
};
