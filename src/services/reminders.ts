import cron from "node-cron";
import { BusinessConfig } from "../types";
import { env } from "../config";
import {
  findBookingsNeedingReminder,
  findBookingsNeedingFollowUp,
  markReminderSent,
  markFollowUpSent,
} from "./bookings";
import { sendWhatsAppMessage } from "./whatsapp";

function serviceName(business: BusinessConfig, serviceId: string): string {
  return business.services.find((s) => s.id === serviceId)?.name ?? serviceId;
}

export async function runReminderSweep(business: BusinessConfig): Promise<void> {
  for (const booking of findBookingsNeedingReminder(business.reminders.hoursBefore)) {
    const message = `Hi ${booking.customerName}, reminder: you're booked for ${serviceName(
      business,
      booking.serviceId
    )} on ${booking.date} at ${booking.time}. Reply if you need to reschedule or cancel.`;
    await sendWhatsAppMessage(booking.phone, message);
    markReminderSent(booking.id);
  }

  for (const booking of findBookingsNeedingFollowUp(business.followUp.hoursAfter)) {
    const message = business.followUp.message.replace("{business}", business.name);
    await sendWhatsAppMessage(booking.phone, message);
    markFollowUpSent(booking.id);
  }
}

export function startReminderScheduler(business: BusinessConfig): void {
  cron.schedule(env.reminderCron, () => {
    runReminderSweep(business).catch((err) => console.error("Reminder sweep failed:", err));
  });
}
