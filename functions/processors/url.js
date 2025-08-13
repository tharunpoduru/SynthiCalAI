import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { processText } from "../utils/gemini.js";

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toIsoOrNull(s) {
  try {
    if (!s || typeof s !== "string") return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function normalizeFromJsonLd(item, pageUrl) {
  const title = item.name || item.title || "Event";
  const start = toIsoOrNull(item.startDate);
  const end = toIsoOrNull(item.endDate);
  const description = typeof item.description === "string" ? item.description : "";
  
  // Safely extract location as string
  let location = "";
  if (item.location) {
    if (typeof item.location === "string") {
      location = item.location;
    } else if (typeof item.location === "object") {
      location = item.location.name || item.location.address || item.location.url || "Online";
    }
  }
  
  return {
    title,
    start_datetime: start || new Date().toISOString(),
    end_datetime: end || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    location,
    description,
    original_link: pageUrl
  };
}

export async function processUrl(url, userTimeZone) {
  try {
    // Basic validation
    const parsed = new URL(url);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // 1) Try JSON-LD first
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const structuredEvents = [];
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent || "{}");
        const items = asArray(data);
        for (const it of items) {
          if (it && (it["@type"] === "Event" || (typeof it["@type"] === "string" && it["@type"].includes("Event")))) {
            structuredEvents.push(normalizeFromJsonLd(it, url));
          }
          if (it && Array.isArray(it["@graph"])) {
            for (const g of it["@graph"]) {
              if (g && (g["@type"] === "Event" || (typeof g["@type"] === "string" && g["@type"].includes("Event")))) {
                structuredEvents.push(normalizeFromJsonLd(g, url));
              }
            }
          }
        }
      } catch {
        // ignore JSON parse errors from unrelated LD blocks
      }
    }
    if (structuredEvents.length > 0) return structuredEvents;

    // 2) Build focused text for model
    const title = document.title || parsed.hostname;
    let main = "";
    const container = document.querySelector("main, article, .content, #content, .post, .entry-content") || document.body;
    if (container) main = container.textContent?.replace(/\s+/g, " ").trim() || "";
    const snippet = main.substring(0, 4000);
    const text = `PAGE TITLE: ${title}\nURL: ${url}\n\nCONTENT:\n${snippet}`;

    const events = await processText({ text, userTimeZone, url });
    return Array.isArray(events) ? events : [events];
  } catch (e) {
    // Fallback single event to avoid total failure
    return [{
      title: "Event",
      start_datetime: new Date().toISOString(),
      end_datetime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      location: "",
      description: `Could not extract details from URL. Error: ${e.message}`,
      original_link: url
    }];
  }
}


