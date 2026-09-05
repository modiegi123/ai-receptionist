import { describe, it, expect } from "vitest";
import { getAvailableSlots, isSlotAvailable } from "../src/services/availability";
import { buildTestBusiness, FUTURE_DATE } from "./testBusiness";

describe("availability", () => {
  it("lists every slot that fits inside opening hours", () => {
    const business = buildTestBusiness();
    const slots = getAvailableSlots(business, FUTURE_DATE, "cut");
    expect(slots).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("reports slots inside hours as available and outside hours as unavailable", () => {
    const business = buildTestBusiness();
    expect(isSlotAvailable(business, FUTURE_DATE, "09:00", "cut")).toBe(true);
    expect(isSlotAvailable(business, FUTURE_DATE, "08:00", "cut")).toBe(false);
  });

  it("returns no slots on a day the business is closed", () => {
    const business = buildTestBusiness();
    expect(getAvailableSlots(business, "2030-06-16", "cut")).toEqual([]);
  });
});
