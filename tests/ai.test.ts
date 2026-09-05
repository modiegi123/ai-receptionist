import { describe, it, expect } from "vitest";
import { createReceptionist, AIClientLike } from "../src/services/ai";
import { listUpcomingBookingsForPhone } from "../src/services/bookings";
import { buildTestBusiness, FUTURE_DATE } from "./testBusiness";

function scriptedClient(responses: any[]): AIClientLike {
  let call = 0;
  return {
    messages: {
      create: async () => responses[Math.min(call++, responses.length - 1)],
    },
  };
}

describe("ai receptionist tool loop", () => {
  it("checks availability, books the appointment, and returns the final reply", async () => {
    const business = buildTestBusiness();
    const phone = "+27011112222";

    const client = scriptedClient([
      {
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "check_availability",
            input: { date: FUTURE_DATE, service_id: "cut" },
          },
        ],
      },
      {
        content: [
          {
            type: "tool_use",
            id: "tool_2",
            name: "book_appointment",
            input: {
              customer_name: "Thabo",
              service_id: "cut",
              date: FUTURE_DATE,
              time: "09:00",
            },
          },
        ],
      },
      {
        content: [{ type: "text", text: "Booked! See you then." }],
      },
    ]);

    const receptionist = createReceptionist(business, client);
    const result = await receptionist.handleMessage(
      phone,
      `Do you have space on ${FUTURE_DATE} at 9?`,
      []
    );

    expect(result.reply).toBe("Booked! See you then.");
    expect(result.history).toHaveLength(2);

    const bookings = listUpcomingBookingsForPhone(phone);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ time: "09:00", date: FUTURE_DATE, serviceId: "cut" });
  });

  it("answers directly without booking when no tool call is needed", async () => {
    const business = buildTestBusiness();
    const client = scriptedClient([
      { content: [{ type: "text", text: "We're at 12 Main Road." }] },
    ]);

    const receptionist = createReceptionist(business, client);
    const result = await receptionist.handleMessage("+27099998888", "Where are you located?", []);

    expect(result.reply).toBe("We're at 12 Main Road.");
    expect(listUpcomingBookingsForPhone("+27099998888")).toHaveLength(0);
  });
});
