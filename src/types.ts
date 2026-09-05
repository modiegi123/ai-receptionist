export interface Service {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface BusinessConfig {
  name: string;
  timezone: string;
  slotMinutes: number;
  hours: Record<DayKey, [string, string] | null>;
  services: Service[];
  faqs: { question: string; answer: string }[];
  reminders: { hoursBefore: number };
  followUp: { hoursAfter: number; message: string };
}

export type BookingStatus = "booked" | "cancelled" | "completed";

export interface Booking {
  id: number;
  phone: string;
  customerName: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: BookingStatus;
  createdAt: string;
  reminderSent: 0 | 1;
  followupSent: 0 | 1;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
