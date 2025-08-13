import { GoogleGenerativeAI } from "@google/generative-ai";

// Use env/secret only. functions.config() is deprecated for Gen 2.
// Set locally via .env and in prod via Firebase Secrets (GEMINI_API_KEY).
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) console.warn("GEMINI_API_KEY not set in .env");

const genAI = new GoogleGenerativeAI(apiKey || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

function normalizeEvents(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.events)) return json.events;
  if (json.event) return [json.event];
  return [json];
}

export async function processText({ text, userTimeZone, url }) {
  const tz = userTimeZone || 'Unknown';
  const header = `You are an expert event extraction assistant. Output ONLY JSON: {"events": [ { "title": "...", "start_datetime": "UTC ISO", "end_datetime": "UTC ISO", "location": "...", "description": "..." } ]}. If there are no events, return {"events": []}. If end time is missing, set end_datetime = start + 1 hour.`;
  const browseHint = url
    ? `A URL is provided: ${url}. If your environment supports browsing, fetch the page and extract events from the live content (prefer schema.org/Event JSON-LD). If browsing is not available, use the CONTENT snippet.`
    : `No URL provided; rely on the CONTENT snippet only.`;
  const now = new Date();
  const nowUtc = now.toISOString();
  let nowInTz = now.toISOString();
  try {
    nowInTz = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(now);
  } catch {}
  const timeHint = `Current date/time (UTC): ${nowUtc}\nUser timezone: ${tz}\nCurrent date/time in user timezone: ${nowInTz}\nUse these values to resolve any relative dates like "today", "tomorrow", "next Friday". Convert all JSON datetime values to UTC ISO.`;
  const composed = `${header}\n\n${browseHint}\n${timeHint}\n\nCONTENT:\n${text || '(empty)'}\n`;
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: composed }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  const out = result.response.text();
  let json;
  try { json = JSON.parse(out); } catch { const m = out.match(/\{[\s\S]*\}/); json = m ? JSON.parse(m[0]) : { events: [] }; }
  return normalizeEvents(json);
}
