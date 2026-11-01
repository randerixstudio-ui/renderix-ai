// Randerix AI — Enhanced Sketch to Full Drawing Converter
// Converts hand sketch → structured floor plan + elevation + 3D concept
// Supports Urdu, English, Arabic input

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { image_base64, media_type, notes, language } = JSON.parse(event.body);
    if (!image_base64) return { statusCode: 400, body: JSON.stringify({ error: "No image provided" }) };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }) };

    const lang = language || "both";
    const langInstruction =
      lang === "arabic" ? "Respond with Arabic text for all description fields." :
      lang === "urdu"   ? "Respond with Urdu script for all description fields." :
      lang === "english"? "Respond in English only." :
      "Respond bilingually — English first, then Urdu for all description fields.";

    const system = `You are a senior Pakistani architect at Randerix AI Studio with 40+ years experience. A client has uploaded a hand-drawn sketch. Interpret it carefully and produce a complete, professional architectural drawing specification.

${langInstruction}

CRITICAL: Respond with ONLY valid JSON, no markdown, no backticks. Match this EXACT structure:

{
  "interpretation_notes": "<what you saw and assumptions made>",
  "plot_size_estimate": "<e.g. 5 Marla / 1125 sqft>",
  "total_covered_area_sqft": <number>,
  "orientation": "<North-South / East-West facing>",

  "rooms": [
    {
      "room": "<English name>",
      "room_urdu": "<Urdu name>",
      "room_arabic": "<Arabic name>",
      "width_ft": <number>,
      "length_ft": <number>,
      "area_sqft": <number>,
      "position": "<front-left / back-right / center / etc>",
      "floor": "<Ground / First / Second>",
      "features": "<window count, attached bath, etc>"
    }
  ],

  "layout_grid": {
    "cols": <2-4>,
    "rows": <2-4>,
    "cells": [
      {
        "room": "<room name>",
        "col_start": <0-indexed>,
        "row_start": <0-indexed>,
        "col_span": <1 or 2>,
        "row_span": <1 or 2>,
        "fill_color": "<light hex color like #F5F0E8 or #E8F0F5>"
      }
    ]
  },

  "floor_schedule": [
    {
      "floor_name": "Ground Floor",
      "rooms": [
        {"name": "<room>", "size": "<14x12 ft>", "area": "<168 sqft>", "notes": "<attached bath, north window>"}
      ]
    }
  ],

  "elevation_front": {
    "style": "<Modern Contemporary / Classical / etc>",
    "height_ft": <number>,
    "width_ft": <number>,
    "description": "<detailed facade description>",
    "main_gate": "<style and material>",
    "windows": "<type, count, size>",
    "cladding": "<material>",
    "roof_type": "<flat / pitched / parapet>",
    "color_scheme": "<primary and accent colors>"
  },

  "elevation_side": {
    "description": "<side wall description>",
    "height_ft": <number>,
    "depth_ft": <number>,
    "features": "<balcony / utility / staircase visible>"
  },

  "materials": {
    "structure": "<brick / RCC frame>",
    "flooring": "<marble / tiles / wood — room specific>",
    "walls_exterior": "<plaster / stone cladding / paint brand>",
    "walls_interior": "<paint brand and finish>",
    "roof": "<RCC slab / wood frame>",
    "windows": "<aluminum / UPVC / wood>",
    "doors": "<wood / steel / glass>"
  },

  "estimated_cost_pkr": {
    "grey_structure": <number>,
    "semi_finished": <number>,
    "full_finished": <number>
  },

  "recommendations": ["<practical advice 1>", "<practical advice 2>", "<practical advice 3>"],
  "vastu_islamic_notes": "<any Islamic or directional recommendations>",

  "summary_english": "<3-4 sentence professional summary>",
  "summary_urdu": "<3-4 sentence Urdu summary>",
  "summary_arabic": "<3-4 sentence Arabic summary>"
}

Be specific and professional. Give real dimensions based on Pakistani standard room sizes. A 5 Marla plot is ~25x45 ft = 1125 sqft per floor. Ensure layout_grid cells do not overlap and fit within cols/rows.`;

    const userText = `Please analyze this hand-drawn floor plan sketch and produce a complete architectural drawing specification with floor plan, elevations, materials, and cost estimate.

${notes ? `Client notes: ${notes}` : "No additional notes provided."}

Produce a thorough, professional response. Respond with ONLY the JSON object.`;

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
            { type: "text", text: userText }
          ]
        }]
      }),
    });

    const data = await response.json();
    if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: data.error?.message || "API error" }) };

    let raw = data.content?.[0]?.text || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { return { statusCode: 500, body: JSON.stringify({ error: "AI returned invalid format. Please try again with a clearer sketch." }) }; }

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error: " + err.message }) };
  }
};
