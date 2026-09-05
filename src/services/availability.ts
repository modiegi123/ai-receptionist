import { db } from "../db";
import { BusinessConfig, DayKey } from "../types";

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function dayKeyFor(dateStr: string): DayKey {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return DAY_KEYS[date.getDay()];
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function isPastDateTime(dateStr: string, hhmm: string): boolean {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime() < Date.now();
}

function serviceDuration(business: BusinessConfig, serviceId: string): number {
  const service = business.services.find((s) => s.id === serviceId);
  if (!service) throw new Error(`Unknown service: ${serviceId}`);
  return service.durationMinutes;
}

interface BookedInterval {
  startMinutes: number;
  endMinutes: number;
}

function getBookedIntervals(business: BusinessConfig, dateStr: string): BookedInterval[] {
  const rows = db
    .prepare(
      `SELECT time, service_id as serviceId FROM bookings WHERE date = ? AND status = 'booked'`
    )
    .all(dateStr) as { time: string; serviceId: string }[];

  return rows.map((row) => {
    const start = toMinutes(row.time);
    const duration = serviceDuration(business, row.serviceId);
    return { startMinutes: start, endMinutes: start + duration };
  });
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Available start times (HH:MM) for a given service on a given date. */
export function getAvailableSlots(
  business: BusinessConfig,
  dateStr: string,
  serviceId: string
): string[] {
  const hours = business.hours[dayKeyFor(dateStr)];
  if (!hours) return [];

  const duration = serviceDuration(business, serviceId);
  const openMinutes = toMinutes(hours[0]);
  const closeMinutes = toMinutes(hours[1]);
  const booked = getBookedIntervals(business, dateStr);

  const slots: string[] = [];
  for (
    let start = openMinutes;
    start + duration <= closeMinutes;
    start += business.slotMinutes
  ) {
    const end = start + duration;
    const conflicts = booked.some((b) => overlaps(start, end, b.startMinutes, b.endMinutes));
    const hhmm = toHHMM(start);
    if (!conflicts && !isPastDateTime(dateStr, hhmm)) {
      slots.push(hhmm);
    }
  }
  return slots;
}

export function isSlotAvailable(
  business: BusinessConfig,
  dateStr: string,
  time: string,
  serviceId: string
): boolean {
  return getAvailableSlots(business, dateStr, serviceId).includes(time);
}
