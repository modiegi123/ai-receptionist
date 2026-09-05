/**
 * Static, rule-based stand-in for the real Claude-powered receptionist.
 * Everything here runs client-side against hardcoded business data —
 * there's no server, no API key, and no data leaves the browser tab.
 * See src/services/ai.ts in the repo for the real implementation.
 */
(function () {
  "use strict";

  var BUSINESS = {
    name: "Fresh Cuts Barbershop",
    slotMinutes: 30,
    hours: {
      sun: null,
      mon: ["09:00", "18:00"],
      tue: ["09:00", "18:00"],
      wed: ["09:00", "18:00"],
      thu: ["09:00", "18:00"],
      fri: ["09:00", "19:00"],
      sat: ["08:00", "15:00"],
    },
    services: [
      { id: "haircut", name: "Haircut", price: 150, durationMinutes: 30 },
      { id: "haircut_beard", name: "Haircut & Beard Trim", price: 220, durationMinutes: 45 },
      { id: "kids_cut", name: "Kids Cut", price: 100, durationMinutes: 20 },
    ],
    faqs: [
      { keywords: ["located", "location", "where", "address"], answer: "We're at 12 Main Road, Sandton." },
      { keywords: ["walk-in", "walk in", "walkin"], answer: "We prioritise bookings, but walk-ins are welcome if there's an open slot." },
      { keywords: ["pay", "payment", "cash", "card", "eft"], answer: "We accept cash, card, and EFT." },
    ],
  };

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_NAMES = {
    sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday",
    thu: "Thursday", fri: "Friday", sat: "Saturday",
  };

  // ---- session state (resets on page reload) ----
  var bookings = []; // {date, time, serviceId, status}
  var pending = null; // {date, time, serviceId} awaiting yes/no
  var pendingDate = null; // {date, serviceId} awaiting a time

  // ---- date/time helpers ----
  function pad(n) { return String(n).padStart(2, "0"); }

  function toDateStr(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function dayKeyFor(dateStr) {
    var parts = dateStr.split("-").map(Number);
    return DAY_KEYS[new Date(parts[0], parts[1] - 1, parts[2]).getDay()];
  }

  function toMinutes(hhmm) {
    var parts = hhmm.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  function toHHMM(mins) {
    return pad(Math.floor(mins / 60)) + ":" + pad(mins % 60);
  }

  function niceDate(dateStr) {
    var parts = dateStr.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return DAY_NAMES[dayKeyFor(dateStr)] + " " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  var WEEKDAY_ALIASES = {
    sun: "sun", sunday: "sun",
    mon: "mon", monday: "mon",
    tue: "tue", tues: "tue", tuesday: "tue",
    wed: "wed", weds: "wed", wednesday: "wed",
    thu: "thu", thur: "thu", thurs: "thu", thursday: "thu",
    fri: "fri", friday: "fri",
    sat: "sat", saturday: "sat",
  };

  function parseDate(text) {
    var today = new Date();
    if (/\btoday\b/.test(text)) return toDateStr(today);
    if (/\btomorrow\b/.test(text)) {
      var t = new Date(today);
      t.setDate(t.getDate() + 1);
      return toDateStr(t);
    }
    var match = text.match(/\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/);
    if (match) {
      var target = DAY_KEYS.indexOf(WEEKDAY_ALIASES[match[1]]);
      var d = new Date(today);
      var diff = (target - d.getDay() + 7) % 7;
      diff = diff === 0 ? 7 : diff; // "Saturday" always means the upcoming one, not today
      if (/\bthis\b/.test(text) && diff <= 7 && (target - today.getDay() + 7) % 7 !== 0) {
        // "this <day>" still just means the next occurrence within the week — keep default.
      }
      d.setDate(d.getDate() + diff);
      return toDateStr(d);
    }
    return null;
  }

  function parseTime(text) {
    var match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (!match) return null;
    var hour = parseInt(match[1], 10);
    var minutes = match[2] ? parseInt(match[2], 10) : 0;
    var meridiem = match[3] ? match[3].toLowerCase() : null;
    if (hour > 23 || minutes > 59) return null;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (!meridiem && hour >= 1 && hour <= 7) hour += 12; // "at 2" during business hours means 2pm
    return toHHMM(hour * 60 + minutes);
  }

  function detectService(text) {
    if (/beard/.test(text)) return "haircut_beard";
    if (/\bkid|child\b/.test(text)) return "kids_cut";
    return "haircut";
  }

  function serviceById(id) {
    return BUSINESS.services.filter(function (s) { return s.id === id; })[0];
  }

  function getAvailableSlots(dateStr, serviceId) {
    var hours = BUSINESS.hours[dayKeyFor(dateStr)];
    if (!hours) return [];
    var duration = serviceById(serviceId).durationMinutes;
    var open = toMinutes(hours[0]);
    var close = toMinutes(hours[1]);

    var booked = bookings
      .filter(function (b) { return b.date === dateStr && b.status === "booked"; })
      .map(function (b) {
        var start = toMinutes(b.time);
        return { start: start, end: start + serviceById(b.serviceId).durationMinutes };
      });

    var isToday = dateStr === toDateStr(new Date());
    var nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    var slots = [];
    for (var start = open; start + duration <= close; start += BUSINESS.slotMinutes) {
      var end = start + duration;
      var conflict = booked.some(function (b) { return start < b.end && b.start < end; });
      if (!conflict && !(isToday && start <= nowMinutes)) {
        slots.push(toHHMM(start));
      }
    }
    return slots;
  }

  // ---- conversation ----
  function isAffirmative(text) {
    return /\b(yes|yeah|yep|sure|ok|okay|confirm|book it|please book|go ahead)\b/.test(text);
  }

  function isNegative(text) {
    return /\b(no|nope|not now|cancel that|never mind)\b/.test(text);
  }

  function isCancelIntent(text) {
    return /\bcancel\b/.test(text) && !/cancel that\b/.test(text);
  }

  function matchFaq(text) {
    for (var i = 0; i < BUSINESS.faqs.length; i++) {
      var faq = BUSINESS.faqs[i];
      if (faq.keywords.some(function (k) { return text.indexOf(k) !== -1; })) return faq.answer;
    }
    return null;
  }

  function isPricingIntent(text) {
    return /\bprice|cost|how much|rates?\b/.test(text);
  }

  function pricingReply() {
    return BUSINESS.services
      .map(function (s) { return s.name + ": R" + s.price + " (" + s.durationMinutes + " min)"; })
      .join("\n");
  }

  function offerSlots(dateStr, serviceId) {
    var slots = getAvailableSlots(dateStr, serviceId);
    var serviceName = serviceById(serviceId).name;
    if (!BUSINESS.hours[dayKeyFor(dateStr)]) {
      return "We're closed on " + DAY_NAMES[dayKeyFor(dateStr)] + "s. Want to try another day?";
    }
    if (slots.length === 0) {
      return "We're fully booked for " + serviceName + " on " + niceDate(dateStr) + ". Want to try another day?";
    }
    return slots[0]; // caller decides how to phrase it
  }

  function respond(rawText) {
    var text = rawText.trim().toLowerCase();

    if (isCancelIntent(text)) {
      var active = bookings.filter(function (b) { return b.status === "booked"; });
      if (active.length === 0) {
        return "You don't have any upcoming booking with us.";
      }
      var toCancel = active[active.length - 1];
      toCancel.status = "cancelled";
      return "Done — your " + serviceById(toCancel.serviceId).name + " on " + niceDate(toCancel.date) + " at " + toCancel.time + " is cancelled.";
    }

    if (pending && isAffirmative(text)) {
      bookings.push({ date: pending.date, time: pending.time, serviceId: pending.serviceId, status: "booked" });
      var confirmed = pending;
      pending = null;
      return "Booked! You're in for a " + serviceById(confirmed.serviceId).name + " on " + niceDate(confirmed.date) + " at " + confirmed.time + ".";
    }

    if (pending && isNegative(text)) {
      pending = null;
      return "No problem — let me know if you'd like a different time.";
    }

    var faqAnswer = matchFaq(text);
    if (faqAnswer) return faqAnswer;

    if (isPricingIntent(text)) return pricingReply();

    var date = parseDate(text);
    var time = parseTime(text);
    var serviceId = detectService(text);

    if (!date && pendingDate) {
      date = pendingDate.date;
      serviceId = pendingDate.serviceId;
    }

    if (date && !time) {
      pendingDate = { date: date, serviceId: serviceId };
      return "What time works for you on " + niceDate(date) + "?";
    }

    if (date && time) {
      pendingDate = null;
      if (!BUSINESS.hours[dayKeyFor(date)]) {
        return "We're closed on " + DAY_NAMES[dayKeyFor(date)] + "s. Want to try another day?";
      }
      var slots = getAvailableSlots(date, serviceId);
      if (slots.indexOf(time) !== -1) {
        pending = { date: date, time: time, serviceId: serviceId };
        return "Yes, " + time + " is open for a " + serviceById(serviceId).name + ". Should I book it?";
      }
      if (slots.length === 0) {
        return "That day's fully booked for a " + serviceById(serviceId).name + ". Want to try another day?";
      }
      return "That slot's taken, but I have " + slots.slice(0, 3).join(", ") + " open on " + niceDate(date) + " — want one of those?";
    }

    if (time && !date) {
      return "Sure — what day would you like to come in?";
    }

    return "Hi! I can check availability & book appointments, answer questions about pricing, hours, or location, or cancel a booking. Try: \"Do you have space Saturday at 2?\"";
  }

  // ---- DOM wiring ----
  var messagesEl = document.getElementById("chatMessages");
  var formEl = document.getElementById("chatForm");
  var inputEl = document.getElementById("chatInput");
  var quickRepliesEl = document.getElementById("quickReplies");

  function addBubble(text, sender) {
    var bubble = document.createElement("div");
    bubble.className = "bubble " + sender;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function handleUserMessage(text) {
    if (!text) return;
    addBubble(text, "user");
    inputEl.value = "";
    setTimeout(function () {
      addBubble(respond(text), "bot");
    }, 500);
  }

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    handleUserMessage(inputEl.value.trim());
  });

  quickRepliesEl.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-msg]");
    if (btn) handleUserMessage(btn.getAttribute("data-msg"));
  });

  addBubble("Hi! Thanks for messaging Fresh Cuts Barbershop. How can I help — booking, pricing, hours, or something else?", "bot");
})();
