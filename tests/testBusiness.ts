import { BusinessConfig } from "../src/types";
import { dayKeyFor } from "../src/services/availability";

/** A date far enough in the future that "is this in the past" checks never trip up tests. */
export const FUTURE_DATE = "2030-06-15";

export function buildTestBusiness(overrides: Partial<BusinessConfig> = {}): BusinessConfig {
  const hours: BusinessConfig["hours"] = {
    mon: null,
    tue: null,
    wed: null,
    thu: null,
    fri: null,
    sat: null,
    sun: null,
  };
  hours[dayKeyFor(FUTURE_DATE)] = ["09:00", "11:00"];

  return {
    name: "Test Barbershop",
    timezone: "Africa/Johannesburg",
    slotMinutes: 30,
    hours,
    services: [{ id: "cut", name: "Haircut", price: 150, durationMinutes: 30 }],
    faqs: [{ question: "Where are you?", answer: "12 Main Road" }],
    reminders: { hoursBefore: 24 },
    followUp: { hoursAfter: 2, message: "Thanks for visiting {business}!" },
    ...overrides,
  };
}
