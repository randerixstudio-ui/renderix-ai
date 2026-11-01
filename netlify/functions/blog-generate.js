// Netlify Function: AI Blog Generator
// Admin provides a topic/keyword, AI writes a full structured SEO-friendly article
// for Randerix AI's architecture/construction blog (Pakistan-focused, bilingual).

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { topic, category, tone, length } = JSON.parse(event.body);

    if (!topic) {
      return { statusCode: 400, body: JSON.stringify({ error: "Topic is required" }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server not configured: ANTHROPIC_API_KEY missing" }) };
    }

    const wordTarget = length === "short" ? "500-700" : length === "long" ? "1200-1500" : "800-1000";

    const system = `You are the content writer for Randerix AI Studio, Pakistan's first AI-powered architecture platform (Faisalabad-based, founded 1985 by Architect Rimsha). You write SEO-optimized, practical, locally-relevant blog articles about architecture, construction, interior design, and real estate for a Pakistani audience. You know Pakistani building costs, material brands, NOC processes, marla/kanal terminology, and local city contexts (Faisalabad, Lahore, Islamabad, Karachi).

CRITICAL: Respond with ONLY valid JSON, no markdown fences, no preamble. Match this exact structure:

{
  "title": "<SEO-friendly catchy title in English>",
  "title_urdu": "<title translated/adapted to Urdu script>",
  "category": "<one of: Architecture Tips, Construction Guide, Interior Design, Case Study, Cost Guide, UAE/Diaspora>",
  "read_time": "<e.g. '7 min read'>",
  "excerpt": "<1-2 sentence hook/summary for the blog card preview, English>",
  "sections": [
    {"heading": "<section heading>", "content": "<2-4 paragraphs of well-written body content for this section, in plain text with \\n\\n between paragraphs>"}
  ],
  "key_takeaways": ["<takeaway 1>", "<takeaway 2>", "<takeaway 3>", "<takeaway 4>"],
  "urdu_summary": "<a 3-4 sentence summary of the whole article written in Urdu script, for Urdu-reading audience>",
  "tags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>"]
}

Write ${wordTarget} words total across sections (excluding takeaways/summary). Use a ${tone || "professional yet approachable"} tone. Include real, practical Pakistani details: actual price ranges, brand names (Berger, ICI Dulux, Lucky Cement, Interwood, etc.), city-specific notes, and genuinely useful advice — not generic filler. Make it genuinely valuable content, not just SEO fluff. Naturally mention Randerix AI's services (cost estimator, floor plan AI, consultations) only once, briefly, near the end — don't be overly promotional.`;

    const prompt = `Write a complete blog article on this topic: "${topic}"
Category: ${category || "Architecture Tips"}

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
        max_tokens: 3000,
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
