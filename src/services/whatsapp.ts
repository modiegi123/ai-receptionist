import { env } from "../config";

let twilioClient: import("twilio").Twilio | null = null;

function getTwilioClient() {
  if (!env.twilioAccountSid || !env.twilioAuthToken) return null;
  if (!twilioClient) {
    const twilio = require("twilio");
    twilioClient = twilio(env.twilioAccountSid, env.twilioAuthToken);
  }
  return twilioClient;
}

/**
 * Sends a WhatsApp message. Falls back to console logging when Twilio
 * credentials aren't configured, so the receptionist can be developed
 * and tested (via `npm run chat`) without a Twilio account.
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const client = getTwilioClient();
  if (!client) {
    console.log(`[whatsapp:simulated -> ${to}] ${body}`);
    return;
  }

  const toAddress = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  await client.messages.create({
    from: env.twilioWhatsappNumber,
    to: toAddress,
    body,
  });
}

export function normalizePhone(twilioFrom: string): string {
  return twilioFrom.replace(/^whatsapp:/, "");
}
