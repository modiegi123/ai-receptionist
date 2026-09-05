import { describe, it, expect } from "vitest";
import {
  createBooking,
  cancelBooking,
  listUpcomingBookingsForPhone,
} from "../src/services/bookings";
import { buildTestBusiness, FUTURE_DATE } from "./testBusiness";

describe("bookings", () => {
  it("creates a booking for an available slot", () => {
    const business = buildTestBusiness();
    const result = createBooking(business, {
      phone: "+27000000001",
      customerName: "Thabo",
      serviceId: "cut",
      date: FUTURE_DATE,
      time: "09:00",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.booking.status).toBe("booked");
    }
  });

  it("refuses to double-book the same slot", () => {
    const business = buildTestBusiness();
    const phone = "+27000000002";
    createBooking(business, {
      phone,
      customerName: "Sipho",
      serviceId: "cut",
      date: FUTURE_DATE,
      time: "10:00",
    });
    const second = createBooking(business, {
      phone: "+27000000003",
      customerName: "Zanele",
      serviceId: "cut",
      date: FUTURE_DATE,
      time: "10:00",
    });
    expect(second).toEqual({ ok: false, reason: "unavailable" });
  });

  it("frees the slot again after cancellation", () => {
    const business = buildTestBusiness();
    const phone = "+27000000004";
    createBooking(business, {
      phone,
      customerName: "Palesa",
      serviceId: "cut",
      date: FUTURE_DATE,
      time: "10:30",
    });
    const cancelled = cancelBooking(phone, FUTURE_DATE, "10:30");
    expect(cancelled.ok).toBe(true);

    const rebooked = createBooking(business, {
      phone: "+27000000005",
      customerName: "Karabo",
      serviceId: "cut",
      date: FUTURE_DATE,
      time: "10:30",
    });
    expect(rebooked.ok).toBe(true);
  });

  it("reports not_found when cancelling a booking that doesn't exist", () => {
    const result = cancelBooking("+27000000099", FUTURE_DATE, "09:00");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("lists only active upcoming bookings for a phone number", () => {
    const business = buildTestBusiness();
    const phone = "+27000000006";
    createBooking(business, {
      phone,
      customerName: "Neo",
      serviceId: "cut",
      date: FUTURE_DATE,
      time: "09:30",
    });
    const upcoming = listUpcomingBookingsForPhone(phone);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].time).toBe("09:30");
  });
});
