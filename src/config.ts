import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { BusinessConfig } from "./types";

export const env = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioWhatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER ?? "",
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "./data/receptionist.db",
  businessConfigPath: process.env.BUSINESS_CONFIG_PATH ?? "./data/business.json",
  reminderCron: process.env.REMINDER_CRON ?? "*/15 * * * *",
};

export function loadBusinessConfig(): BusinessConfig {
  const raw = fs.readFileSync(path.resolve(env.businessConfigPath), "utf-8");
  return JSON.parse(raw) as BusinessConfig;
}
