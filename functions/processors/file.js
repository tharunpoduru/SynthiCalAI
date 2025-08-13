import fetch from "node-fetch";

const API_ROOT = "https://generativelanguage.googleapis.com";

/**
 * Upload a file to Gemini Files API and extract events using gemini-2.5-pro.
 * Accepts raw bytes via multer (memoryStorage) as req.file.
 */
export async function processUploadedFile(file, userTimeZone) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  if (!file || !file.buffer || !file.mimetype) {
    throw new Error("Invalid file input");
  }

  const baseMime = (file.mimetype || "application/octet-stream").split(";")[0];

  // 1) Start resumable upload
  const startResp = await fetch(`${API_ROOT}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(file.buffer.length),
      "X-Goog-Upload-Header-Content-Type": baseMime,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Goog-Api-Key": apiKey
    },
    body: JSON.stringify({ file: { display_name: file.originalname || "upload" } })
  });
  if (!startResp.ok) {
    const t = await startResp.text();
    throw new Error(`Upload init failed: ${startResp.status} ${t}`);
  }
  const uploadUrl = startResp.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Missing upload URL from Gemini");

  // 2) Upload bytes and finalize
  const uploadResp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Type": "application/octet-stream",
      "X-Goog-Api-Key": apiKey
    },
    body: file.buffer
  });
  if (!uploadResp.ok) {
    const t = await uploadResp.text();
    throw new Error(`Upload failed: ${uploadResp.status} ${t}`);
  }
  const uploaded = await uploadResp.json();
  const fileName = uploaded?.file?.name;
  const fileUri = uploaded?.file?.uri;
  if (!fileName || !fileUri) throw new Error("Upload response missing file name/uri");

  // 3) Poll for ACTIVE state (max ~45s)
  for (let i = 0; i < 45; i++) {
    const st = await fetch(`${API_ROOT}/v1beta/${fileName}`, { headers: { "X-Goog-Api-Key": apiKey } });
    if (st.ok) {
      const js = await st.json();
      if (js.state === "ACTIVE") break;
      if (js.state === "FAILED") throw new Error("Gemini file processing failed");
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // 4) Generate content
  const nowUtc = new Date().toISOString();
  const tz = userTimeZone || 'Unknown';
  const prompt = `You are an expert event extraction assistant. Analyze the attached media (image/document/audio) and extract events. Output ONLY JSON: {"events": [ { "title": "...", "start_datetime": "UTC ISO", "end_datetime": "UTC ISO", "location": "...", "description": "..." } ]}. If there are no events, return {"events": []}. If end time is missing, set end_datetime = start + 1 hour.\n\nCurrent date/time (UTC): ${nowUtc}\nUser timezone: ${tz}\nUse these values to resolve any relative dates like "today", "tomorrow", "next Friday". Convert all JSON datetime values to UTC ISO.`;
  const genResp = await fetch(`${API_ROOT}/v1beta/models/gemini-2.5-pro:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [ { text: prompt }, { file_data: { mime_type: baseMime, file_uri: fileUri } } ] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  if (!genResp.ok) {
    const t = await genResp.text();
    throw new Error(`Generate failed: ${genResp.status} ${t}`);
  }
  const gen = await genResp.json();
  const txt = gen?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let parsed = { events: [] };
  try { parsed = JSON.parse(txt); } catch {}

  // 5) Cleanup (best effort)
  try { await fetch(`${API_ROOT}/v1beta/${fileName}`, { method: "DELETE", headers: { "X-Goog-Api-Key": apiKey } }); } catch {}

  return Array.isArray(parsed) ? parsed : (parsed.events || []);
}

