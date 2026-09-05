import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config";

const isInMemory = env.dbPath === ":memory:";
const resolvedPath = isInMemory ? env.dbPath : path.resolve(env.dbPath);
if (!isInMemory) {
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
}

export const db = new Database(resolvedPath);
if (!isInMemory) {
  db.pragma("journal_mode = WAL");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    service_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked',
    created_at TEXT NOT NULL,
    reminder_sent INTEGER NOT NULL DEFAULT 0,
    followup_sent INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS conversations (
    phone TEXT PRIMARY KEY,
    history TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
