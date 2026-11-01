// ============================================================
// Randerix AI — WhatsApp AI Bot
// Netlify Function: netlify/functions/whatsapp-bot.js
//
// SETUP — Netlify Environment Variables needed:
//   ANTHROPIC_API_KEY    — console.anthropic.com
//   TWILIO_ACCOUNT_SID   — twilio.com console
//   TWILIO_AUTH_TOKEN    — twilio.com console
//   TWILIO_WHATSAPP_NUM  — e.g. whatsapp:+14155238886
//   ALERT_NUMBER         — e.g. whatsapp:+923294839897
// ============================================================

const SYSTEM_PROMPT = `You are Randerix AI — the WhatsApp assistant for Randerix AI Studio, Pakistan's first AI architecture platform. Founded 1985 by Architect Rimsha, Faisalabad.

Personality: Warm, expert, friendly — like a knowledgeable architect friend, not a robot.

You help with: construction costs (PKR), floor plans, interior design, NOC process, UAE remote consultation.

LANGUAGE: Urdu message → Urdu reply. English → English. Mixed → both.

RESPONSE STYLE:
- SHORT replies (max 150 words) — this is WhatsApp not email
- 1-3 emojis max, natural
- Short paragraphs
- Always end with a question or next step

COMMANDS:
- "cost" or "لاگت" → ask: plot size, city, finishing, floors
- "floor" or "فلور پلان" → ask: plot size, beds, family, floors
- "uae" → UAE remote consultation info
- "price" → service pricing (PKR 30K-200K+ range)
- "free" → explain free consultation

After 5 messages or when client seems ready to hire, say:
"Architect Rimsha se free 15-minute call karein? 📞 Kya aap appointment book karna chahenge?"

Website: randerixai.netlify.app`;

const conversations = {};

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const params  = new URLSearchParams(event.body);
    const from    = params.get("From") || "";
    const msgBody = (params.get("Body") || "").trim();
    if (!from || !msgBody) return twimlResponse("");

    const clientId = from.replace("whatsapp:", "");
    if (!conversations[clientId]) conversations[clientId] = { messages: [], count: 0 };
    const convo = conversations[clientId];
    convo.count++;
    convo.messages.push({ role: "user", content: msgBody });
    if (convo.messages.length > 10) convo.messages = convo.messages.slice(-10);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return twimlResponse("AI service unavailable. Please call +92 329 4839897 🙏");

    const aiRes  = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, system: SYSTEM_PROMPT, messages: convo.messages }),
    });
    const aiData = await aiRes.json();
    const reply  = aiData.content?.[0]?.text || "Maafi. Please WhatsApp: +92 329 4839897";
    convo.messages.push({ role: "assistant", content: reply });

    if (convo.count === 5) await alertHuman(clientId, convo.messages);

    return twimlResponse(reply);
  } catch (err) {
    console.error("Bot error:", err);
    return twimlResponse("Technical masla. Please +92 329 4839897 pe call karein 🙏");
  }
};

function twimlResponse(msg) {
  const xml = msg
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: xml };
}

async function alertHuman(clientNum, messages) {
  const { ALERT_NUMBER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUM } = process.env;
  if (!ALERT_NUMBER || !TWILIO_ACCOUNT_SID) return;
  const recent = messages.slice(-4).map(m => `${m.role === "user" ? "Client" : "AI"}: ${m.content.substring(0,80)}`).join("\n");
  const alertMsg = `🔔 Hot Lead — Randerix AI\n\nClient: ${clientNum}\n5+ messages exchanged\n\nRecent:\n${recent}\n\n👆 Client may be ready to book!`;
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64") },
      body: new URLSearchParams({ From: TWILIO_WHATSAPP_NUM, To: ALERT_NUMBER, Body: alertMsg }),
    });
  } catch(e) { console.error("Alert failed:", e); }
}
