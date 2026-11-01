// Netlify Function: AI Cost Estimator
// Returns structured JSON (not just free text) so the frontend can show real PKR numbers in cards.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { size, city, finish, floors, extra } = JSON.parse(event.body);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server not configured: ANTHROPIC_API_KEY missing" }) };
    }

    const system = `You are an expert Pakistani construction cost estimator for Randerix AI Studio. You know current 2025-2026 material and labor costs across Pakistani cities (Faisalabad, Lahore, Islamabad, Karachi, Rawalpindi, Multan). 

CRITICAL: You must respond with ONLY valid JSON, no markdown formatting, no backticks, no preamble. The JSON must match this exact structure:

{
  "grey_structure_pkr": <number, no commas, just the integer PKR amount>,
  "semi_finished_pkr": <number>,
  "full_finished_pkr": <number>,
  "full_luxury_pkr": <number>,
  "rate_per_sqft_pkr": <number, average rate per square foot for the finishing level selected>,
  "material_cost_percent": <number, e.g. 60>,
  "labor_cost_percent": <number, e.g. 40>,
  "summary_english": "<2-3 sentence summary in English>",
  "summary_urdu": "<2-3 sentence summary in Urdu script>",
  "money_saving_tips": ["<tip 1>", "<tip 2>", "<tip 3>"],
  "timeline_months": "<estimated construction timeline, e.g. '8-10 months'"
}

Base your estimates on realistic 2025-2026 Pakistani construction market rates. Grey structure typically PKR 2,800-3,500/sqft, semi-finished PKR 3,800-4,800/sqft, full finished standard PKR 5,000-6,500/sqft, full luxury PKR 7,000-10,000+/sqft, varying by city (Karachi/Islamabad higher, Faisalabad/Multan lower).`;

    const prompt = `Calculate construction cost for:
- Plot Size: ${size}
- City: ${city}
- Desired Finishing Level: ${finish}
- Floors: ${floors}
- Special Requirements: ${extra || "None"}

Respond with ONLY the JSON object, nothing else.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data.error?.message || "Anthropic API error" }) };
    }

    let raw = data.content && data.content[0] ? data.content[0].text : "{}";
    // Strip any accidental markdown fences
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: "AI returned invalid format. Please try again." }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error: " + err.message }) };
  }
};
