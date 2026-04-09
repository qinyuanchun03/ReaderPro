import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Book {
  id: string;
  title: string;
  author: string;
  cover?: string;
  data: ArrayBuffer;
  addedAt: number;
  lastReadPosition?: string;
  annotations?: { cfiRange: string; text: string }[];
}

interface ReaderDB extends DBSchema {
  books: {
    key: string;
    value: Book;
  };
}

let dbPromise: Promise<IDBPDatabase<ReaderDB>>;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<ReaderDB>('reader-pro-db', 1, {
      upgrade(db) {
        db.createObjectStore('books', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
};

export const saveBook = async (book: Book) => {
  const db = await getDB();
  await db.put('books', book);
};

export const getAllBooks = async () => {
  const db = await getDB();
  return db.getAll('books');
};

export const getBook = async (id: string) => {
  const db = await getDB();
  return db.get('books', id);
};

export const deleteBook = async (id: string) => {
  const db = await getDB();
  await db.delete('books', id);
};

export const updateReadPosition = async (id: string, position: string) => {
  const db = await getDB();
  const book = await db.get('books', id);
  if (book) {
    book.lastReadPosition = position;
    await db.put('books', book);
  }
};

export const updateAnnotations = async (id: string, annotations: { cfiRange: string; text: string }[]) => {
  const db = await getDB();
  const book = await db.get('books', id);
  if (book) {
    book.annotations = annotations;
    await db.put('books', book);
  }
};
