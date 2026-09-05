import { db } from "../db";
import { Booking, BusinessConfig } from "../types";
import { isSlotAvailable } from "./availability";

function toBooking(row: any): Booking {
  return {
    id: row.id,
    phone: row.phone,
    customerName: row.customer_name,
    serviceId: row.service_id,
    date: row.date,
    time: row.time,
    status: row.status,
    createdAt: row.created_at,
    reminderSent: row.reminder_sent,
    followupSent: row.followup_sent,
  };
}

export interface CreateBookingInput {
  phone: string;
  customerName: string;
  serviceId: string;
  date: string;
  time: string;
}

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "unavailable" | "unknown_service" };

export function createBooking(
  business: BusinessConfig,
  input: CreateBookingInput
): CreateBookingResult {
  if (!business.services.some((s) => s.id === input.serviceId)) {
    return { ok: false, reason: "unknown_service" };
  }
  if (!isSlotAvailable(business, input.date, input.time, input.serviceId)) {
    return { ok: false, reason: "unavailable" };
  }

  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO bookings (phone, customer_name, service_id, date, time, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'booked', ?)`
    )
    .run(input.phone, input.customerName, input.serviceId, input.date, input.time, createdAt);

  const row = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(result.lastInsertRowid);
  return { ok: true, booking: toBooking(row) };
}

export type CancelBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not_found" };

export function cancelBooking(
  phone: string,
  date: string,
  time: string
): CancelBookingResult {
  const row = db
    .prepare(
      `SELECT * FROM bookings WHERE phone = ? AND date = ? AND time = ? AND status = 'booked'`
    )
    .get(phone, date, time) as any;
  if (!row) return { ok: false, reason: "not_found" };

  db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(row.id);
  return { ok: true, booking: toBooking({ ...row, status: "cancelled" }) };
}

export function listUpcomingBookingsForPhone(phone: string): Booking[] {
  const rows = db
    .prepare(
      `SELECT * FROM bookings WHERE phone = ? AND status = 'booked' ORDER BY date, time`
    )
    .all(phone);
  return rows.map(toBooking);
}

export function findBookingsNeedingReminder(hoursBefore: number): Booking[] {
  const cutoff = new Date(Date.now() + hoursBefore * 60 * 60 * 1000);
  const rows = db
    .prepare(`SELECT * FROM bookings WHERE status = 'booked' AND reminder_sent = 0`)
    .all();
  return rows
    .map(toBooking)
    .filter((b) => new Date(`${b.date}T${b.time}:00`).getTime() <= cutoff.getTime());
}

export function findBookingsNeedingFollowUp(hoursAfter: number): Booking[] {
  const cutoff = new Date(Date.now() - hoursAfter * 60 * 60 * 1000);
  const rows = db
    .prepare(
      `SELECT * FROM bookings WHERE status IN ('booked', 'completed') AND followup_sent = 0`
    )
    .all();
  return rows
    .map(toBooking)
    .filter((b) => new Date(`${b.date}T${b.time}:00`).getTime() <= cutoff.getTime());
}

export function markReminderSent(id: number): void {
  db.prepare(`UPDATE bookings SET reminder_sent = 1 WHERE id = ?`).run(id);
}

export function markFollowUpSent(id: number): void {
  db.prepare(
    `UPDATE bookings SET followup_sent = 1, status = CASE WHEN status = 'booked' THEN 'completed' ELSE status END WHERE id = ?`
  ).run(id);
}
