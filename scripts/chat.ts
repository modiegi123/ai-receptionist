/**
 * Local CLI simulator for the WhatsApp receptionist — lets you have the
 * barber-shop style conversation in a terminal instead of over WhatsApp.
 * Requires ANTHROPIC_API_KEY to be set. Run with `npm run chat`.
 */
import readline from "node:readline";
import { loadBusinessConfig } from "../src/config";
import { createReceptionist } from "../src/services/ai";
import { ChatMessage } from "../src/types";
import "../src/db";

const business = loadBusinessConfig();
const receptionist = createReceptionist(business);
const phone = "+15550000000";
let history: ChatMessage[] = [];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log(`Chatting with the ${business.name} AI receptionist. Type 'exit' to quit.\n`);

function prompt() {
  rl.question("You: ", async (line) => {
    if (line.trim().toLowerCase() === "exit") {
      rl.close();
      return;
    }
    const result = await receptionist.handleMessage(phone, line, history);
    history = result.history;
    console.log(`AI: ${result.reply}\n`);
    prompt();
  });
}

prompt();
