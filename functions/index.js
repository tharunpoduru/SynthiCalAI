import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import express from "express";
import cors from "cors";
import busboy from "busboy";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";


import { processText } from "./utils/gemini.js";
import { processUploadedFile } from "./processors/file.js";
import { processUrl } from "./processors/url.js";
import { generateICS } from "./utils/ics-generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from repo root for local dev
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

initializeApp();

const app = express();
app.use(cors({ origin: true }));



const router = express.Router();

router.get("/health", (_req, res) => res.status(200).json({ ok: true }));

router.post("/process-text", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    const text = req.body?.text ?? req.body?.content;
    const userTimeZone = req.body?.userTimeZone;
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });
    const events = await processText({ text, userTimeZone });
    res.status(200).json({ events });
  } catch (e) {
    res.status(500).json({ error: "Failed to process text", details: e.message });
  }
});

router.post("/process-file", async (req, res) => {
  try {
    // Firebase Functions stores the raw body in req.rawBody
    if (!req.rawBody) {
      return res.status(400).json({ error: "No file data received" });
    }

    const bb = busboy({ headers: req.headers });
    let filename = "upload";
    let mimeType = "application/octet-stream";
    let userTimeZone = "";
    const chunks = [];

    bb.on("file", (_name, file, info) => {
      filename = info?.filename || filename;
      mimeType = info?.mimeType || mimeType;
      file.on("data", (d) => chunks.push(d));
      file.on("limit", () => {
        file.resume();
      });
      file.on("end", () => {
        console.log('File stream ended');
      });
    });

    bb.on("field", (name, val) => {
      if (name === "userTimeZone") userTimeZone = val;
    });

    bb.on("error", (err) => {
      console.error('Busboy error:', err);
      res.status(400).json({ error: "Invalid multipart data", details: err.message });
    });

    bb.on("finish", async () => {
      try {
        console.log('Busboy finished, chunks:', chunks.length);
        if (chunks.length === 0) return res.status(400).json({ error: "No file uploaded" });
        const buffer = Buffer.concat(chunks);
        console.log('Buffer size:', buffer.length);
        const events = await processUploadedFile({ buffer, mimetype: mimeType, originalname: filename }, userTimeZone);
        res.status(200).json({ events: Array.isArray(events) ? events : [events] });
      } catch (e) {
        console.error('File processing error:', e);
        res.status(500).json({ error: "Failed to process file", details: e.message });
      }
    });

    // Use req.rawBody instead of piping req directly
    bb.end(req.rawBody);
  } catch (e) {
    console.error('Endpoint error:', e);
    res.status(500).json({ error: "Failed to process file", details: e.message });
  }
});

router.post("/process-url", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    const { url, userTimeZone } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing url" });
    const events = await processUrl(url, userTimeZone);
    res.status(200).json({ events: Array.isArray(events) ? events : [events] });
  } catch (e) {
    res.status(500).json({ error: "Failed to process url", details: e.message });
  }
});

router.post("/generate-ics", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (events.length === 0) return res.status(400).json({ error: "Provide events: Event[]" });
    const ics = await generateICS(events);
    res.set("Content-Type", "text/calendar");
    res.set("Content-Disposition", "attachment; filename=events.ics");
    res.status(200).send(ics);
  } catch (e) {
    res.status(500).json({ error: "Failed to generate ICS", details: e.message });
  }
});



// Mount router under /api to match Hosting rewrite "source": "/api/**"
app.use("/api", router);

// Central error handler to ensure JSON errors (helps avoid HTML 500 pages)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({ error: 'Internal Server Error', details: err.message || String(err) });
});

export const api = onRequest({ cors: true, invoker: "public", secrets: ["GEMINI_API_KEY"] }, app);
