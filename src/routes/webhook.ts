import { Router } from "express";
import { BusinessConfig } from "../types";
import { createReceptionist } from "../services/ai";
import { loadHistory, saveHistory } from "../services/conversations";
import { normalizePhone, sendWhatsAppMessage } from "../services/whatsapp";

export function createWebhookRouter(business: BusinessConfig): Router {
  const router = Router();
  const receptionist = createReceptionist(business);

  router.post("/whatsapp", async (req, res) => {
    const from = req.body.From as string | undefined;
    const body = (req.body.Body as string | undefined)?.trim();

    if (!from || !body) {
      res.status(400).send("Missing From or Body");
      return;
    }

    const phone = normalizePhone(from);

    try {
      const history = loadHistory(phone);
      const { reply, history: newHistory } = await receptionist.handleMessage(
        phone,
        body,
        history
      );
      saveHistory(phone, newHistory);
      await sendWhatsAppMessage(from, reply);
      res.status(200).send("OK");
    } catch (err) {
      console.error("Failed to handle WhatsApp message:", err);
      res.status(500).send("Internal error");
    }
  });

  return router;
}
