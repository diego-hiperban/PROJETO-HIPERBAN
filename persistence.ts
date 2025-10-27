const DB_NAME = 'hiperban-db';
const STORE_NAME = 'entities';
const DB_VERSION = 1;
const STORAGE_PREFIX = 'hiperban-db::';

const memoryStore = new Map<string, string>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

const isBrowser = () => typeof window !== 'undefined';

const hasIndexedDb = () => isBrowser() && typeof window.indexedDB !== 'undefined';

const openDatabase = (): Promise<IDBDatabase | null> => {
  if (!hasIndexedDb()) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let request: IDBOpenDBRequest;

      try {
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        console.warn(
          'IndexedDB não pôde ser inicializado; recorrendo ao localStorage como fallback.',
          error,
        );
        resolve(null);
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        console.warn('Não foi possível abrir o banco IndexedDB, usando localStorage como fallback.', request.error);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('A abertura do IndexedDB foi bloqueada; usando localStorage como fallback.');
        resolve(null);
      };
    });
  }

  return dbPromise;
};

const readFromLocalStorage = <T>(key: string): T | undefined => {
  if (!isBrowser()) {
    const fallback = memoryStore.get(`${STORAGE_PREFIX}${key}`);
    return fallback ? (JSON.parse(fallback) as T) : undefined;
  }

  try {
    const storage = window.localStorage;
    const raw = storage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) {
      const fallback = memoryStore.get(`${STORAGE_PREFIX}${key}`);
      return fallback ? (JSON.parse(fallback) as T) : undefined;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('Falha ao restaurar dados salvos localmente.', error);
    const fallback = memoryStore.get(`${STORAGE_PREFIX}${key}`);
    if (!fallback) {
      return undefined;
    }
    try {
      return JSON.parse(fallback) as T;
    } catch (fallbackError) {
      console.warn('Falha ao restaurar dados do fallback em memória.', fallbackError);
      return undefined;
    }
  }
};

const writeToLocalStorage = <T>(key: string, value: T | undefined) => {
  const storageKey = `${STORAGE_PREFIX}${key}`;

  if (!isBrowser()) {
    if (value === undefined) {
      memoryStore.delete(storageKey);
      return;
    }
    memoryStore.set(storageKey, JSON.stringify(value));
    return;
  }

  try {
    const storage = window.localStorage;
    if (value === undefined) {
      storage.removeItem(storageKey);
      memoryStore.delete(storageKey);
      return;
    }
    const serialized = JSON.stringify(value);
    storage.setItem(storageKey, serialized);
    memoryStore.set(storageKey, serialized);
  } catch (error) {
    console.warn('Não foi possível persistir dados localmente.', error);
    if (value === undefined) {
      memoryStore.delete(storageKey);
      return;
    }
    try {
      memoryStore.set(storageKey, JSON.stringify(value));
    } catch (fallbackError) {
      console.warn('Falha ao registrar dados no fallback em memória.', fallbackError);
    }
  }
};

export async function readValue<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase().catch(() => null);
  if (!db) {
    return readFromLocalStorage<T>(key);
  }

  return new Promise<T | undefined>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as T | undefined;
      resolve(result ?? readFromLocalStorage<T>(key));
    };

    request.onerror = () => {
      console.warn('Erro ao ler dados do IndexedDB, utilizando fallback.', request.error);
      resolve(readFromLocalStorage<T>(key));
    };
  });
}

export async function writeValue<T>(key: string, value: T | undefined): Promise<void> {
  const db = await openDatabase().catch(() => null);

  if (!db) {
    writeToLocalStorage(key, value);
    return;
  }

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = value === undefined ? store.delete(key) : store.put(value, key);

    request.onsuccess = () => {
      writeToLocalStorage(key, value);
      resolve();
    };

    request.onerror = () => {
      console.warn('Erro ao gravar dados no IndexedDB, recorrendo ao localStorage.', request.error);
      writeToLocalStorage(key, value);
      resolve();
    };
  });
}

export async function clearValue(key: string): Promise<void> {
  await writeValue(key, undefined);
}

export async function clearAll(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => writeValue(key, undefined)));
}
