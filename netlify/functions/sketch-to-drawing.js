// ============================================================
// Randerix AI — Sketch to Full Drawing Converter
// Converts hand sketch to: 2D Floor Plan + 3D Isometric + Elevations
// All in one combined PDF download
// Supports: Urdu, English, Arabic, Hindi
// ============================================================

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { image_base64, media_type, notes, language } = JSON.parse(event.body);
    if (!image_base64) {
      return { statusCode: 400, body: JSON.stringify({ error: "No image provided" }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }) };
    }

    // Language-specific instructions
    const langInstructions = {
      urdu:    "Respond with all text fields in Urdu script (اردو). Keep JSON keys in English.",
      arabic:  "Respond with all text fields in Arabic script (عربي). Keep JSON keys in English.",
      hindi:   "Respond with all text fields in Hindi (हिंदी). Keep JSON keys in English.",
      english: "Respond with all text fields in English.",
    };
    const langNote = langInstructions[language] || "Respond with text fields in both English and Urdu.";

    const system = `You are a senior architect at Randerix AI Studio, Pakistan's first AI architecture platform (Est. 1985, Faisalabad). A client has uploaded a hand-drawn floor plan sketch. Convert it into a complete, professional architectural drawing specification.

${langNote}

CRITICAL: Respond with ONLY valid JSON, no markdown, no backticks, no preamble. Use this EXACT structure:

{
  "project_title": "<project name>",
  "interpretation": "<what you see in the sketch, assumptions made>",
  "plot_size": "<estimated plot size>",
  "total_area_sqft": <number>,
  "scale_note": "<e.g. 1:100 or approximate>",

  "floor_plan_2d": {
    "orientation": "<North direction note>",
    "rooms": [
      {
        "id": "<e.g. R1>",
        "name": "<room name>",
        "name_local": "<room name in requested language>",
        "width_ft": <number>,
        "length_ft": <number>,
        "area_sqft": <number>,
        "position": "<e.g. front-left, center, back-right>",
        "floor": "<Ground/First/Second>",
        "features": ["<feature1>", "<feature2>"],
        "grid_col": <0-indexed column in layout grid>,
        "grid_row": <0-indexed row in layout grid>,
        "col_span": <1 or 2>,
        "row_span": <1 or 2>
      }
    ],
    "grid_cols": <total columns 2-5>,
    "grid_rows": <total rows 1-5>,
    "walls": [
      { "from": "<room_id or edge>", "to": "<room_id or edge>", "type": "<exterior/interior/partition>" }
    ],
    "doors": [
      { "room_id": "<R1>", "position": "<north/south/east/west>", "type": "<main/bedroom/bathroom>" }
    ],
    "windows": [
      { "room_id": "<R1>", "position": "<north/south/east/west>", "count": <number> }
    ]
  },

  "isometric_3d": {
    "building_width_ft": <number>,
    "building_depth_ft": <number>,
    "floor_height_ft": <number>,
    "num_floors": <number>,
    "roof_type": "<flat/sloped/parapet>",
    "main_features": ["<feature1>", "<feature2>", "<feature3>"],
    "volumes": [
      { "label": "<e.g. Ground Floor Block>", "x_ft": <number>, "y_ft": <number>, "w_ft": <number>, "d_ft": <number>, "h_ft": <number> }
    ]
  },

  "elevations": {
    "front": {
      "description": "<detailed front elevation description>",
      "width_ft": <number>,
      "height_ft": <number>,
      "features": ["<main entrance>", "<windows>", "<parapet>"],
      "materials": ["<material1>", "<material2>"],
      "floors_visible": <number>,
      "elements": [
        { "type": "<door/window/wall/parapet/column>", "position": "<left/center/right>", "width_ft": <number>, "height_ft": <number>, "from_ground_ft": <number> }
      ]
    },
    "side": {
      "description": "<side elevation description>",
      "width_ft": <number>,
      "height_ft": <number>,
      "features": ["<feature1>", "<feature2>"],
      "elements": [
        { "type": "<window/wall/parapet>", "position": "<left/center/right>", "width_ft": <number>, "height_ft": <number>, "from_ground_ft": <number> }
      ]
    },
    "rear": {
      "description": "<rear elevation description>",
      "features": ["<feature1>"]
    }
  },

  "material_schedule": [
    { "item": "<e.g. External Walls>", "specification": "<e.g. 9 inch brick, plaster, paint>", "brand_suggestion": "<e.g. Berger Weathercoat>" }
  ],

  "area_schedule": [
    { "room": "<name>", "area_sqft": <number>, "floor": "<Ground/First>" }
  ],

  "structural_notes": ["<note1>", "<note2>", "<note3>"],

  "summary": "<2-3 sentence project summary in requested language>",
  "architect_note": "<professional advice for the client>"
}

Be precise and practical. Base dimensions on Pakistani construction standards (1 Marla = 225 sqft, standard room min 10x10 ft, standard floor height 10 ft). Grid positions must not overlap. col_start + col_span must not exceed grid_cols.`;

    const userMsg = `Please convert this hand-drawn floor plan sketch into a complete professional architectural drawing specification. ${notes ? "Client notes: " + notes : ""} Language preference: ${language || "bilingual (English + Urdu)"}. Respond with ONLY the JSON object.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image_base64 } },
            { type: "text", text: userMsg }
          ]
        }]
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data.error?.message || "API error" }) };
    }

    let raw = data.content?.[0]?.text || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: "AI returned invalid format. Please try with a clearer sketch." }) };
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
