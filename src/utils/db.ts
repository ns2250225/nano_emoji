import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface MemeHistory extends DBSchema {
  history: {
    key: number
    value: {
      id?: number
      blob: Blob
      subject: string
      createdAt: number
    }
    indexes: { 'by-date': number }
  }
}

const DB_NAME = 'MemeGeneratorDB'
const DB_VERSION = 1
const STORE_NAME = 'history'

let dbPromise: Promise<IDBPDatabase<MemeHistory>>

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<MemeHistory>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('by-date', 'createdAt')
      },
    })
  }
  return dbPromise
}

export const saveMemeToHistory = async (blob: Blob, subject: string) => {
  const db = await initDB()
  await db.add(STORE_NAME, {
    blob,
    subject,
    createdAt: Date.now(),
  })
}

export const getMemeHistory = async () => {
  const db = await initDB()
  return await db.getAllFromIndex(STORE_NAME, 'by-date')
}

export const deleteMemeFromHistory = async (id: number) => {
  const db = await initDB()
  await db.delete(STORE_NAME, id)
}
