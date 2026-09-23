export type BusinessHours = {
  days: number[];
  openTime: string;
  closeTime: string;
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  days: [1, 2, 3, 4, 5],
  openTime: "08:00",
  closeTime: "18:00",
};

const VALID_DAY = new Set([1, 2, 3, 4, 5, 6, 7]);
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeTime(value: unknown, fallback: string) {
  const raw = String(value || "").trim().slice(0, 5);
  return TIME_PATTERN.test(raw) ? raw : fallback;
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function businessHoursSubmitted(form: FormData, prefix = "business_") {
  return form.has(`${prefix}open_time`)
    || form.has(`${prefix}close_time`)
    || form.has(`${prefix}days`);
}

export function readBusinessHours(
  form: FormData,
  prefix = "business_",
  fallback: BusinessHours = DEFAULT_BUSINESS_HOURS,
): BusinessHours {
  const days = form.getAll(`${prefix}days`)
    .map(value => Number(value))
    .filter(day => Number.isInteger(day) && VALID_DAY.has(day));

  const normalizedDays = days.length ? Array.from(new Set(days)).sort((a, b) => a - b) : fallback.days;
  const openTime = normalizeTime(form.get(`${prefix}open_time`), fallback.openTime);
  const closeTime = normalizeTime(form.get(`${prefix}close_time`), fallback.closeTime);

  if (!normalizedDays.length) throw new Error("BUSINESS_DAYS_REQUIRED");
  if (minutes(openTime) >= minutes(closeTime)) throw new Error("BUSINESS_HOURS_INVALID");

  return { days: normalizedDays, openTime, closeTime };
}

export function normalizeBusinessHoursRow(row: {
  business_days?: number[] | null;
  business_open_time?: string | null;
  business_close_time?: string | null;
}): BusinessHours {
  const days = Array.isArray(row.business_days)
    ? row.business_days.map(Number).filter(day => VALID_DAY.has(day))
    : [];
  return {
    days: days.length ? days : DEFAULT_BUSINESS_HOURS.days,
    openTime: normalizeTime(row.business_open_time, DEFAULT_BUSINESS_HOURS.openTime),
    closeTime: normalizeTime(row.business_close_time, DEFAULT_BUSINESS_HOURS.closeTime),
  };
}

const WEEKDAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function isBusinessOpenNow(hours: BusinessHours, timezone: string, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Bogota",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const day = WEEKDAY[values.weekday] || 0;
    const current = Number(values.hour) * 60 + Number(values.minute);
    return hours.days.includes(day)
      && current >= minutes(hours.openTime)
      && current < minutes(hours.closeTime);
  } catch {
    return false;
  }
}
