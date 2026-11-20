// NEXORA natural-language reminder parser.
// Supports examples such as:
// "school wake up at 10:45"
// "tomorrow at 7 pm call mom"
// "every day at 6:30 am gym"

const WEEKDAYS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6
};

function setClock(base, hour, minute) {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function extractTime(input) {
  const m = input.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  const meridiem = (m[3] || "").toLowerCase().replace(/\./g, "");
  if (hour > 23 || minute > 59 || (meridiem && (hour < 1 || hour > 12))) return null;
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return { hour, minute, raw: m[0] };
}

export function parseReminder(input, now = new Date()) {
  const original = String(input || "").trim();
  if (!original) return { ok: false, error: "Type or speak a reminder first." };

  const lower = original.toLowerCase();
  const time = extractTime(lower);
  if (!time) {
    return { ok: false, error: "Please include a time, for example: tomorrow at 7 pm call mom." };
  }

  const repeat = /\b(every day|everyday|daily|each day)\b/i.test(lower);
  let at = new Date(now);
  at.setSeconds(0, 0);

  if (/\btomorrow\b/i.test(lower)) {
    at.setDate(at.getDate() + 1);
  } else if (/\btoday\b/i.test(lower)) {
    // Keep today's date.
  } else {
    const weekdayMatch = lower.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (weekdayMatch) {
      const target = WEEKDAYS[weekdayMatch[2].toLowerCase()];
      let delta = (target - at.getDay() + 7) % 7;
      if (delta === 0 || weekdayMatch[1]) delta += 7;
      at.setDate(at.getDate() + delta);
    }
  }

  at = setClock(at, time.hour, time.minute);
  if (!repeat && !/\btomorrow\b|\btoday\b|\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b|\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(lower) && at <= now) {
    at.setDate(at.getDate() + 1);
  }

  let title = original
    .replace(/\b(every day|everyday|daily|each day)\b/ig, " ")
    .replace(/\b(tomorrow|today|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig, " ")
    .replace(/\btomorrow\b|\btoday\b/ig, " ")
    .replace(/\bat\s*\d{1,2}(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?/ig, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b/ig, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();

  if (!title) title = "Reminder";
  const kind = /\b(alarm|wake\s*up|wake me)\b/i.test(original) ? "alarm" : "reminder";

  return { ok: true, title, kind, repeat, at, hasTime: true };
}

export function planReminder(parsed, now = new Date()) {
  let fireAt = new Date(parsed.at);
  if (parsed.repeat) {
    fireAt = new Date(now);
    fireAt.setHours(parsed.at.getHours(), parsed.at.getMinutes(), 0, 0);
    if (fireAt <= now) fireAt.setDate(fireAt.getDate() + 1);
    return { fireAt, note: "A daily reminder notification is scheduled." };
  }
  if (fireAt <= now) fireAt.setDate(fireAt.getDate() + 1);
  return { fireAt, note: "Your reminder notification is scheduled." };
}
