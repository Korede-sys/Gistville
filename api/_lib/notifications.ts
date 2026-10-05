// WhatsApp/SMS notifications via Twilio. Tries WhatsApp first (cheaper,
// richer), falls back to plain SMS if no WhatsApp sender is configured or
// the WhatsApp send fails. Uses Twilio's REST API directly over fetch (no
// twilio SDK) so this works in the edge runtime.
//
// --- Setup (you don't have a Twilio account yet — here's the short path) ---
// 1. Create a free account at https://www.twilio.com/try-twilio (needs an
//    email + phone number to verify; a free trial account includes some
//    credit and can send real messages to numbers you've verified).
// 2. From the Twilio Console dashboard, copy:
//      Account SID  -> TWILIO_ACCOUNT_SID
//      Auth Token   -> TWILIO_AUTH_TOKEN
// 3. For WhatsApp (recommended — no per-message carrier fees in most
//    countries, and this app's users already think in WhatsApp): Console ->
//    Messaging -> Try it out -> Send a WhatsApp message. Twilio gives you a
//    sandbox number and a join code; set:
//      TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (Twilio's sandbox number)
//    Each recipient must send the given join code to that number once from
//    their own WhatsApp before you can message them (sandbox limitation —
//    a paid WhatsApp Business sender removes this once you're ready to go
//    live, via Twilio's WhatsApp Senders onboarding).
// 4. For plain SMS instead/as a fallback: buy a Twilio phone number
//    (Console -> Phone Numbers -> Buy a number) and set:
//      TWILIO_SMS_FROM=+1xxxxxxxxxx
// 5. Add whichever of TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
//    TWILIO_WHATSAPP_FROM / TWILIO_SMS_FROM you set up to your Vercel env
//    vars. Notifications are skipped (not an error) if these aren't set —
//    the rest of the app works fine without them.

interface SendResult {
  ok: boolean;
  channel?: "whatsapp" | "sms";
  error?: string;
}

async function twilioSend(from: string, to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { ok: false, error: "Twilio not configured" };

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.message ?? `Twilio error ${res.status}` };
  }
  return { ok: true };
}

/** Normalizes a Nigerian-style local number (080...) to E.164 (+234...). */
function toE164Nigeria(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.startsWith("234")) return `+${digits}`;
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Sends a notification to a phone number, WhatsApp first then SMS fallback.
 * Silently no-ops (returns ok:false with a reason, never throws) if Twilio
 * isn't configured — callers should fire-and-forget this, never block a
 * core flow (order creation, dispute filing, etc.) on it.
 */
export async function sendNotification(phone: string | null | undefined, message: string): Promise<SendResult> {
  if (!phone) return { ok: false, error: "No phone number on file" };
  const to = toE164Nigeria(phone);

  const waFrom = process.env.TWILIO_WHATSAPP_FROM;
  if (waFrom) {
    const waResult = await twilioSend(waFrom, `whatsapp:${to}`, message);
    if (waResult.ok) return { ok: true, channel: "whatsapp" };
  }

  const smsFrom = process.env.TWILIO_SMS_FROM;
  if (smsFrom) {
    const smsResult = await twilioSend(smsFrom, to, message);
    if (smsResult.ok) return { ok: true, channel: "sms" };
    return { ok: false, error: smsResult.error };
  }

  return { ok: false, error: "No Twilio sender configured" };
}
