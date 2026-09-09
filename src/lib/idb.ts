import type { Post, Profile } from './types';

/**
 * Armazenamento local em IndexedDB.
 *
 * As fotos ficam como `Blob` — o navegador guarda os bytes originais, sem
 * conversão. É o que permite postar uma foto de 1,5 MB sem estourar cota nem
 * inflar 33% como aconteceria com base64 em localStorage. As URLs de exibição
 * são criadas sob demanda com `URL.createObjectURL` e ficam num cache, porque
 * criar uma por render vaza memória.
 */

const DB_NAME = 'croma';
const DB_VERSION = 1;

const STORE_IMAGES = 'images';
const STORE_POSTS = 'posts';
const STORE_PROFILES = 'profiles';
const STORE_KV = 'kv';

export interface StoredImage {
  id: string;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  mime: string;
  bytes: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_POSTS)) {
        const posts = db.createObjectStore(STORE_POSTS, { keyPath: 'id' });
        posts.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponível.'));
    req.onblocked = () => reject(new Error('Outra aba do Croma está bloqueando o banco.'));
  });

  return dbPromise;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/* ---------- imagens ---------- */

export function putImage(img: StoredImage): Promise<unknown> {
  return run(STORE_IMAGES, 'readwrite', (s) => s.put(img));
}

export function getImage(id: string): Promise<StoredImage | undefined> {
  return run<StoredImage | undefined>(STORE_IMAGES, 'readonly', (s) => s.get(id));
}

export async function deleteImage(id: string): Promise<void> {
  releaseUrls(id);
  await run(STORE_IMAGES, 'readwrite', (s) => s.delete(id));
}

/* ---------- posts ---------- */

export function putPost(post: Post): Promise<unknown> {
  return run(STORE_POSTS, 'readwrite', (s) => s.put(post));
}

export function allPosts(): Promise<Post[]> {
  return run<Post[]>(STORE_POSTS, 'readonly', (s) => s.getAll());
}

export function deletePost(id: string): Promise<unknown> {
  return run(STORE_POSTS, 'readwrite', (s) => s.delete(id));
}

/* ---------- perfis ---------- */

export function putProfile(profile: Profile): Promise<unknown> {
  return run(STORE_PROFILES, 'readwrite', (s) => s.put(profile));
}

export function allProfiles(): Promise<Profile[]> {
  return run<Profile[]>(STORE_PROFILES, 'readonly', (s) => s.getAll());
}

/* ---------- chave/valor ---------- */

export function getKV<T>(key: string): Promise<T | undefined> {
  return run<T | undefined>(STORE_KV, 'readonly', (s) => s.get(key));
}

export function setKV(key: string, value: unknown): Promise<unknown> {
  return run(STORE_KV, 'readwrite', (s) => s.put(value, key));
}

/* ---------- URLs de exibição ---------- */

type Variant = 'full' | 'thumb';

const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

function cacheKey(id: string, variant: Variant) {
  return `${variant}:${id}`;
}

/** URL utilizável em `<img src>` para uma imagem guardada. */
export function imageUrl(id: string, variant: Variant = 'full'): Promise<string | null> {
  const key = cacheKey(id, variant);

  const cached = urlCache.get(key);
  if (cached) return Promise.resolve(cached);

  const inflight = pending.get(key);
  if (inflight) return inflight;

  const p = getImage(id)
    .then((img) => {
      if (!img) return null;
      const url = URL.createObjectURL(variant === 'thumb' ? img.thumb : img.full);
      urlCache.set(key, url);
      return url;
    })
    .catch(() => null)
    .finally(() => pending.delete(key));

  pending.set(key, p);
  return p;
}

/** URL já pronta, se existir — evita um estado de carregamento desnecessário. */
export function cachedUrl(id: string, variant: Variant = 'full'): string | undefined {
  return urlCache.get(cacheKey(id, variant));
}

function releaseUrls(id: string) {
  for (const variant of ['full', 'thumb'] as Variant[]) {
    const key = cacheKey(id, variant);
    const url = urlCache.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      urlCache.delete(key);
    }
  }
}

/* ---------- manutenção ---------- */

export interface StorageUsage {
  usadoBytes: number;
  cotaBytes: number;
  fotos: number;
}

export async function storageUsage(): Promise<StorageUsage> {
  const imgs = await run<StoredImage[]>(STORE_IMAGES, 'readonly', (s) => s.getAll());
  const somaFotos = imgs.reduce((total, i) => total + i.full.size + i.thumb.size, 0);

  let cota = 0;
  let usado = somaFotos;
  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      cota = est.quota ?? 0;
      usado = est.usage ?? somaFotos;
    } catch {
      /* alguns navegadores bloqueiam a estimativa */
    }
  }

  return { usadoBytes: usado, cotaBytes: cota, fotos: imgs.length };
}

/**
 * Pede armazenamento persistente.
 *
 * Sem isso o navegador pode limpar o IndexedDB sozinho quando o disco aperta —
 * e as fotos do usuário sumiriam sem aviso.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function wipeAll(): Promise<void> {
  const db = await openDB();
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [STORE_IMAGES, STORE_POSTS, STORE_PROFILES, STORE_KV],
      'readwrite',
    );
    tx.objectStore(STORE_IMAGES).clear();
    tx.objectStore(STORE_POSTS).clear();
    tx.objectStore(STORE_PROFILES).clear();
    tx.objectStore(STORE_KV).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
