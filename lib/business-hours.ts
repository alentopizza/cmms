export type BusinessDaySchedule = {
  day: number;
  enabled: boolean;
  openTime: string;
  closeTime: string;
};

export type BusinessHours = {
  days: number[];
  openTime: string;
  closeTime: string;
  schedule: BusinessDaySchedule[];
};

export class BusinessHoursValidationError extends Error {
  code: "business-days" | "business-hours";

  constructor(code: "business-days" | "business-hours", message: string) {
    super(message);
    this.name = "BusinessHoursValidationError";
    this.code = code;
  }
}

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

function defaultSchedule(): BusinessDaySchedule[] {
  return [1, 2, 3, 4, 5, 6, 7].map(day => ({
    day,
    enabled: day <= 5,
    openTime: "08:00",
    closeTime: "18:00",
  }));
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  days: [1, 2, 3, 4, 5],
  openTime: "08:00",
  closeTime: "18:00",
  schedule: defaultSchedule(),
};

function normalizeSchedule(
  value: unknown,
  fallback: BusinessHours = DEFAULT_BUSINESS_HOURS,
): BusinessDaySchedule[] {
  const fallbackByDay = new Map(
    (fallback.schedule?.length ? fallback.schedule : defaultSchedule()).map(item => [item.day, item]),
  );
  const raw = Array.isArray(value) ? value : [];
  const byDay = new Map<number, BusinessDaySchedule>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<BusinessDaySchedule>;
    const day = Number(row.day);
    if (!VALID_DAY.has(day)) continue;
    const fallbackRow = fallbackByDay.get(day) || {
      day,
      enabled: fallback.days.includes(day),
      openTime: fallback.openTime,
      closeTime: fallback.closeTime,
    };
    byDay.set(day, {
      day,
      enabled: Boolean(row.enabled),
      openTime: normalizeTime(row.openTime, fallbackRow.openTime),
      closeTime: normalizeTime(row.closeTime, fallbackRow.closeTime),
    });
  }

  return [1, 2, 3, 4, 5, 6, 7].map(day => {
    const fallbackRow = fallbackByDay.get(day) || {
      day,
      enabled: fallback.days.includes(day),
      openTime: fallback.openTime,
      closeTime: fallback.closeTime,
    };
    return byDay.get(day) || { ...fallbackRow };
  });
}

function legacySchedule(days: number[], openTime: string, closeTime: string) {
  return [1, 2, 3, 4, 5, 6, 7].map(day => ({
    day,
    enabled: days.includes(day),
    openTime,
    closeTime,
  }));
}

function validateSchedule(schedule: BusinessDaySchedule[]) {
  const enabled = schedule.filter(item => item.enabled);
  if (!enabled.length) {
    throw new BusinessHoursValidationError("business-days", "Selecciona al menos un día de atención.");
  }
  for (const item of enabled) {
    if (minutes(item.openTime) >= minutes(item.closeTime)) {
      throw new BusinessHoursValidationError(
        "business-hours",
        "En cada día activo la hora de cierre debe ser posterior a la hora de apertura.",
      );
    }
  }
}

export function businessHoursSubmitted(form: FormData, prefix = "business_") {
  return form.has(`${prefix}schedule_json`)
    || form.has(`${prefix}open_time`)
    || form.has(`${prefix}close_time`)
    || form.has(`${prefix}days`);
}

export function readBusinessHours(
  form: FormData,
  prefix = "business_",
  fallback: BusinessHours = DEFAULT_BUSINESS_HOURS,
): BusinessHours {
  let schedule: BusinessDaySchedule[] | null = null;
  const scheduleJson = String(form.get(`${prefix}schedule_json`) || "").trim();

  if (scheduleJson) {
    try {
      schedule = normalizeSchedule(JSON.parse(scheduleJson), fallback);
    } catch {
      throw new BusinessHoursValidationError("business-hours", "El horario enviado no tiene un formato válido.");
    }
  }

  if (!schedule) {
    const days = form.getAll(`${prefix}days`)
      .map(value => Number(value))
      .filter(day => Number.isInteger(day) && VALID_DAY.has(day));

    const normalizedDays = days.length ? Array.from(new Set(days)).sort((a, b) => a - b) : fallback.days;
    const openTime = normalizeTime(form.get(`${prefix}open_time`), fallback.openTime);
    const closeTime = normalizeTime(form.get(`${prefix}close_time`), fallback.closeTime);
    schedule = legacySchedule(normalizedDays, openTime, closeTime);
  }

  validateSchedule(schedule);
  const enabled = schedule.filter(item => item.enabled);
  const representative = enabled[0];

  return {
    days: enabled.map(item => item.day),
    openTime: representative.openTime,
    closeTime: representative.closeTime,
    schedule,
  };
}

export function normalizeBusinessHoursRow(row: {
  business_days?: number[] | null;
  business_open_time?: string | null;
  business_close_time?: string | null;
  business_schedule?: unknown;
}): BusinessHours {
  const days = Array.isArray(row.business_days)
    ? row.business_days.map(Number).filter(day => VALID_DAY.has(day))
    : [];
  const normalizedDays = days.length ? days : DEFAULT_BUSINESS_HOURS.days;
  const openTime = normalizeTime(row.business_open_time, DEFAULT_BUSINESS_HOURS.openTime);
  const closeTime = normalizeTime(row.business_close_time, DEFAULT_BUSINESS_HOURS.closeTime);

  const fallback: BusinessHours = {
    days: normalizedDays,
    openTime,
    closeTime,
    schedule: legacySchedule(normalizedDays, openTime, closeTime),
  };
  const schedule = normalizeSchedule(row.business_schedule, fallback);

  return {
    days: schedule.filter(item => item.enabled).map(item => item.day),
    openTime: schedule.find(item => item.enabled)?.openTime || openTime,
    closeTime: schedule.find(item => item.enabled)?.closeTime || closeTime,
    schedule,
  };
}

export function businessHoursScheduleJson(hours: BusinessHours) {
  return JSON.stringify(hours.schedule);
}

export function businessHoursFromSchedule(
  value: unknown,
  fallback: BusinessHours = DEFAULT_BUSINESS_HOURS,
): BusinessHours {
  const schedule = normalizeSchedule(value, fallback);
  validateSchedule(schedule);
  const enabled = schedule.filter(item => item.enabled);
  const representative = enabled[0];

  return {
    days: enabled.map(item => item.day),
    openTime: representative.openTime,
    closeTime: representative.closeTime,
    schedule,
  };
}

export function businessScheduleWeeklyMinutes(schedule: BusinessDaySchedule[]) {
  return schedule.reduce((total,item) => {
    if (!item.enabled) return total;
    return total + Math.max(0, minutes(item.closeTime) - minutes(item.openTime));
  }, 0);
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
    const daySchedule = hours.schedule.find(item => item.day === day);

    return Boolean(
      daySchedule?.enabled
      && current >= minutes(daySchedule.openTime)
      && current < minutes(daySchedule.closeTime),
    );
  } catch {
    return false;
  }
}
