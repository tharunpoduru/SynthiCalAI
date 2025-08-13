import { createEvents } from "ics";

function formatDescription(desc) {
  return (desc || "").replace(/\[br\]/g, "\n");
}

export async function generateICS(events) {
  const items = events.map((e) => {
    const start = new Date(e.start_datetime || Date.now());
    const end = new Date(e.end_datetime || (start.getTime() + 3600000));
    return {
      title: e.title || "Event",
      start: [start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()],
      end: [end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes()],
      location: e.location || "",
      description: formatDescription(e.description || ""),
      url: e.original_link || ""
    };
  });
  const { error, value } = createEvents(items);
  if (error) throw error;
  return value;
}
