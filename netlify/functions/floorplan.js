// Netlify Function: AI Floor Plan Generator
// Returns structured JSON with room-by-room breakdown so frontend can render a visual layout.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { size, beds, family, floors, req } = JSON.parse(event.body);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server not configured: ANTHROPIC_API_KEY missing" }) };
    }

    const system = `You are an expert Pakistani architect at Randerix AI Studio specializing in floor plan design. You know Pakistani lifestyle requirements, joint family dynamics, privacy norms (separate male/female sitting areas), and local construction practices.

CRITICAL: Respond with ONLY valid JSON, no markdown, no backticks, no preamble. Match this exact structure:

{
  "plot_size": "<echo the plot size>",
  "total_covered_area_sqft": <number>,
  "ground_floor": [
    {"room": "<room name in English>", "room_urdu": "<room name in Urdu>", "size_sqft": "<e.g. '14x12 (168 sqft)'"},
    ...more rooms
  ],
  "upper_floor": [
    {"room": "<room name>", "room_urdu": "<Urdu name>", "size_sqft": "<dimensions>"}
  ],
  "optimization_tips": ["<tip1>", "<tip2>", "<tip3>"],
  "common_mistakes": ["<mistake1>", "<mistake2>"],
  "summary_urdu": "<2-3 sentence summary in Urdu script>",
  "summary_english": "<2-3 sentence summary in English>"
}

If the floor selection is "Ground Floor Only", return an empty array for upper_floor. Be realistic with Pakistani home sizing — e.g. a 5 Marla plot is ~1125 sqft per floor, 10 Marla ~2250 sqft per floor, 1 Kanal ~4500 sqft per floor. Include practical rooms: drawing room, lounge/TV room, dining, kitchen, bedrooms with attached baths, store room, car porch, garden/lawn space if applicable.`;

    const prompt = `Design an optimal floor plan for:
- Plot: ${size}
- Bedrooms required: ${beds}
- Family size: ${family}
- Floor configuration: ${floors}
- Special requirements: ${req || "Standard family home, no special requirements"}

Respond with ONLY the JSON object.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data.error?.message || "Anthropic API error" }) };
    }

    let raw = data.content && data.content[0] ? data.content[0].text : "{}";
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
