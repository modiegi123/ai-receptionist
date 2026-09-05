# AI Receptionist

An AI receptionist for small businesses, delivered over WhatsApp. A customer messages the business's WhatsApp number, and Claude handles the conversation — checking availability, booking, answering FAQs and pricing questions, cancelling, and following up — using the business's own hours, services and prices as ground truth.

Example:

```
Customer: Do you have space Saturday at 2?
AI:       Let me check... Yes, 14:00 is open for a Haircut. Should I book it?
Customer: Yes
AI:       Booked! You're in for a Haircut on Saturday at 14:00.
```

## What it handles

- **WhatsApp conversations** — inbound/outbound messages via Twilio's WhatsApp API
- **Bookings** — checks real availability against opening hours and existing bookings before confirming
- **FAQs & pricing** — answered from the business's own config, never invented
- **Reminders** — automatic reminder sent a configurable number of hours before an appointment
- **Cancellations** — customer can cancel by asking
- **Follow-ups** — automatic message after the appointment window, asking for feedback / a rebooking

## How it works

- `data/business.json` is the single source of truth for one business: name, hours, services (with price and duration), FAQs, reminder timing, and follow-up message. Point this at a different file per client — nothing else needs to change.
- `src/services/ai.ts` drives the conversation with the Claude API. The business config is rendered into the system prompt (hours, services, FAQs), and the model is given three **tools** — `check_availability`, `book_appointment`, `cancel_appointment` — so it can never invent a time slot or silently double-book; every booking action goes through real, deterministic business logic in `src/services/bookings.ts` and `src/services/availability.ts`.
- `src/services/whatsapp.ts` sends replies through Twilio. Without Twilio credentials configured, it logs messages to the console instead, so the rest of the system is fully runnable without a WhatsApp Business account.
- `src/services/reminders.ts` runs on a cron schedule (`REMINDER_CRON`, default every 15 minutes), sweeping for bookings that need a reminder or a post-appointment follow-up.
- Conversation history per phone number is persisted in SQLite (`src/services/conversations.ts`) so context survives across messages and restarts.

## Setup

```bash
npm install
cp .env.example .env
# fill in ANTHROPIC_API_KEY (required)
# fill in TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_NUMBER (optional — omit to run in console-log mode)
```

Edit `data/business.json` to describe your business (or point `BUSINESS_CONFIG_PATH` at a different file).

### Run the server

```bash
npm run dev
```

This starts an Express server with:
- `POST /webhook/whatsapp` — point your Twilio WhatsApp sandbox/number's webhook here
- `GET /health` — basic health check

### Try it without WhatsApp or Twilio

```bash
npm run chat
```

Chats with the receptionist directly in your terminal (still needs `ANTHROPIC_API_KEY`), simulating exactly what a WhatsApp customer would experience.

### Tests

```bash
npm test
```

Unit and integration tests cover availability calculation, booking/cancellation logic (double-booking prevention, slot release on cancel), and the tool-calling loop in `ai.ts` (using a scripted fake Claude client, so the suite runs offline without an API key).

## Deploying

Any Node host works. Point Twilio's WhatsApp webhook at `https://<your-host>/webhook/whatsapp`, and make sure `ANTHROPIC_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_WHATSAPP_NUMBER` are set in the deployment environment. The SQLite file at `DB_PATH` should live on persistent storage.

## Notes / limitations

- Date/time handling assumes the server's local clock matches the business's timezone (`data/business.json`'s `timezone` field is descriptive context for the model, not currently used to convert times).
- This is a single-business-per-deployment design. Running multiple businesses means running multiple deployments, each with its own `business.json` and `DB_PATH`.
