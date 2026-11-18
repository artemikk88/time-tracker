// Правила учёта часов: диапазон, шаг 0.5, недельная норма из ставки.

export const MAX_DAY_HOURS = 12;
export const STEP_HOURS = 0.5;
/** Часы полной ставки в неделю (1.0 = 40 ч). */
export const BASE_WEEK_HOURS = 40;
export const MIN_RATE = 0.05;
export const MAX_RATE = 2;

const EPS = 1e-9;

/** Округление до ближайших 0.5 ч (для «+/-» кнопок). */
export function roundToStep(value: number): number {
  return Math.round(value / STEP_HOURS) * STEP_HOURS;
}

/** Валидные часы: конечное число, 0..12, кратно 0.5. */
export function isValidHours(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (value < 0 || value > MAX_DAY_HOURS) return false;
  return Math.abs(roundToStep(value) - value) < EPS;
}

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** "HH:MM" -> минуты от полуночи, либо null. */
function parseTimeMinutes(value: string): number | null {
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const minutes = Number(m[2]);
  if (h > 23 || minutes > 59) return null;
  return h * 60 + minutes;
}

/**
 * Часы из диапазона времени «начало–конец»: ("09:00", "17:30") -> 8.5.
 * Диапазон через полночь ("22:00"–"02:00") — ночная смена, длительность
 * считается до конца на следующие сутки. Длительность округляется до 0.5 ч.
 * Возвращает null, если время неполное/некорректное или диапазон
 * не выражается в 0.5–12 ч.
 */
export function hoursFromRange(from: string, to: string): number | null {
  const start = parseTimeMinutes(from);
  const end = parseTimeMinutes(to);
  if (start === null || end === null) return null;
  let minutes = end - start;
  if (minutes <= 0) minutes += 24 * 60; // переход через полночь
  const hours = roundToStep(minutes / 60);
  if (hours <= 0 || hours > MAX_DAY_HOURS) return null;
  return hours;
}

/** Текст «09:00–17:30» для сохранённого диапазона; null, если диапазона нет. */
export function formatTimeRange(start?: string | null, end?: string | null): string | null {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (parseTimeMinutes(s) === null || parseTimeMinutes(e) === null) return null;
  return `${s}–${e}`;
}

/** Недельная норма: переопределение или ставка × 40. */
export function resolveWeeklyNorm(rate: number, weeklyNormOverride?: number | null): number {
  if (weeklyNormOverride != null && Number.isFinite(weeklyNormOverride) && weeklyNormOverride >= 0) {
    return weeklyNormOverride;
  }
  return rate * BASE_WEEK_HOURS;
}

export function sumHours(entries: { hours: number }[]): number {
  return entries.reduce((acc, e) => acc + e.hours, 0);
}

/** Итог недели к норме: зелёный — норма и больше, жёлтый — меньше. */
export type NormStatus = "ok" | "under" | "empty";

export function normStatus(total: number, norm: number): NormStatus {
  if (total <= 0) return "empty";
  return total >= norm - EPS ? "ok" : "under";
}

export function formatHours(value: number): string {
  // 20 вместо 20.0, 7.5 остаётся 7.5
  return String(Math.round(value * 100) / 100);
}
