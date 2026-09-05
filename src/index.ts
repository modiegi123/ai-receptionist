import express from "express";
import { env, loadBusinessConfig } from "./config";
import { createWebhookRouter } from "./routes/webhook";
import { startReminderScheduler } from "./services/reminders";
import "./db";

const business = loadBusinessConfig();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", business: business.name }));
app.use("/webhook", createWebhookRouter(business));

startReminderScheduler(business);

app.listen(env.port, () => {
  console.log(`${business.name} AI receptionist listening on port ${env.port}`);
  if (!env.anthropicApiKey) {
    console.warn("ANTHROPIC_API_KEY is not set — conversation handling will fail until it is.");
  }
  if (!env.twilioAccountSid) {
    console.warn("Twilio credentials not set — outgoing messages will be logged, not sent.");
  }
});
