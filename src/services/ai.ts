import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config";
import { BusinessConfig, ChatMessage } from "../types";
import { getAvailableSlots } from "./availability";
import { createBooking, cancelBooking } from "./bookings";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description:
      "Look up open appointment times for a given service on a given date. Always call this before offering times to the customer.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format." },
        service_id: { type: "string", description: "The service id being booked." },
      },
      required: ["date", "service_id"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Book an appointment for the customer. Only call this after the customer has confirmed a specific date, time and service.",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string" },
        service_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM, 24-hour" },
      },
      required: ["customer_name", "service_id", "date", "time"],
    },
  },
  {
    name: "cancel_appointment",
    description: "Cancel an existing booked appointment for this customer.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM, 24-hour" },
      },
      required: ["date", "time"],
    },
  },
];

function buildSystemPrompt(business: BusinessConfig): string {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekday = today.toLocaleDateString("en-US", { weekday: "long" });

  const servicesList = business.services
    .map((s) => `- ${s.name} (id: ${s.id}): R${s.price}, ${s.durationMinutes} min`)
    .join("\n");

  const hoursList = Object.entries(business.hours)
    .map(([day, range]) => `- ${day}: ${range ? `${range[0]}-${range[1]}` : "closed"}`)
    .join("\n");

  const faqList = business.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

  return `You are the AI receptionist for ${business.name}, a small business that takes bookings over WhatsApp.
Today is ${todayStr} (${weekday}). Timezone: ${business.timezone}.

Services:
${servicesList}

Opening hours:
${hoursList}

Frequently asked questions:
${faqList}

Rules:
- Reply like a helpful, concise WhatsApp receptionist — short messages, no markdown, no headers.
- Never state a price, time slot, or opening hour that isn't in the data above or returned by a tool.
- Always call check_availability before proposing times. Never invent availability.
- Always confirm the service, date and time with the customer before calling book_appointment.
- Ask for the customer's name if you don't already have it before booking.
- If a requested slot is unavailable, offer the nearest alternatives from check_availability.
- If asked to cancel, confirm which booking (date/time) before calling cancel_appointment.
- If a question isn't covered by the FAQs or services above, say you'll have someone from the business follow up — don't guess.`;
}

export interface AIClientLike {
  messages: {
    create(params: any): Promise<any>;
  };
}

export interface HandleMessageResult {
  reply: string;
  history: ChatMessage[];
}

function executeTool(
  business: BusinessConfig,
  phone: string,
  name: string,
  input: any
): unknown {
  switch (name) {
    case "check_availability": {
      const slots = getAvailableSlots(business, input.date, input.service_id);
      return { date: input.date, service_id: input.service_id, available_times: slots };
    }
    case "book_appointment": {
      const result = createBooking(business, {
        phone,
        customerName: input.customer_name,
        serviceId: input.service_id,
        date: input.date,
        time: input.time,
      });
      if (!result.ok) return { success: false, reason: result.reason };
      return {
        success: true,
        booking_id: result.booking.id,
        date: result.booking.date,
        time: result.booking.time,
      };
    }
    case "cancel_appointment": {
      const result = cancelBooking(phone, input.date, input.time);
      if (!result.ok) return { success: false, reason: result.reason };
      return { success: true };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const MAX_TOOL_ROUNDS = 5;

export function createReceptionist(business: BusinessConfig, client?: AIClientLike) {
  const anthropic: AIClientLike =
    client ?? new Anthropic({ apiKey: env.anthropicApiKey });

  async function handleMessage(
    phone: string,
    userText: string,
    history: ChatMessage[]
  ): Promise<HandleMessageResult> {
    const messages: any[] = history.map((h) => ({ role: h.role, content: h.content }));
    messages.push({ role: "user", content: userText });

    let finalText = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: env.anthropicModel,
        max_tokens: 1024,
        system: buildSystemPrompt(business),
        tools: TOOLS,
        messages,
      });

      const content: any[] = response.content;
      const toolUses = content.filter((b) => b.type === "tool_use");
      const textBlocks = content.filter((b) => b.type === "text");
      finalText = textBlocks.map((b) => b.text).join("\n");

      messages.push({ role: "assistant", content });

      if (toolUses.length === 0) break;

      const toolResults = toolUses.map((tu) => ({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(executeTool(business, phone, tu.name, tu.input)),
      }));
      messages.push({ role: "user", content: toolResults });
    }

    const newHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: userText },
      { role: "assistant", content: finalText },
    ];

    return { reply: finalText, history: newHistory };
  }

  return { handleMessage };
}
