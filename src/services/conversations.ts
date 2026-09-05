import { db } from "../db";
import { ChatMessage } from "../types";

const MAX_HISTORY_MESSAGES = 20;

export function loadHistory(phone: string): ChatMessage[] {
  const row = db.prepare(`SELECT history FROM conversations WHERE phone = ?`).get(phone) as
    | { history: string }
    | undefined;
  if (!row) return [];
  return JSON.parse(row.history) as ChatMessage[];
}

export function saveHistory(phone: string, history: ChatMessage[]): void {
  const trimmed = history.slice(-MAX_HISTORY_MESSAGES);
  db.prepare(
    `INSERT INTO conversations (phone, history, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET history = excluded.history, updated_at = excluded.updated_at`
  ).run(phone, JSON.stringify(trimmed), new Date().toISOString());
}
