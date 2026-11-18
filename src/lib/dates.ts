// Работа с датами без таймзонных сюрпризов: даты ходят между клиентом и сервером
// как строки "YYYY-MM-DD", сервер считает их непрозрачными ключами дней.

export const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

const MONTHS_NOM = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

// Родительный падеж: «16–22 ноября»
const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Дата -> "YYYY-MM-DD" по локальному времени. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" -> Date (локальный полдень, чтобы не съезжало при арифметике). */
export function parseISODate(iso: string): Date {
  if (!isValidISODate(iso)) throw new Error(`Некорректная дата: ${iso}`);
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Строгая проверка: формат + реальная календарная дата (не 2026-02-30). */
export function isValidISODate(iso: string): boolean {
  if (!DATE_RE.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** "YYYY-MM" (валидный месяц) или null. */
export function isValidMonth(month: string): boolean {
  if (!MONTH_RE.test(month)) return false;
  const m = Number(month.slice(5, 7));
  return m >= 1 && m <= 12;
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Понедельник недели, в которую попадает дата. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const dow = d.getDay(); // 0 = вс
  const shift = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + shift);
  return toISODate(d);
}

/** 7 ISO-дат недели (Пн..Вс) по любой дате этой недели. */
export function weekDates(anyDayISO: string): string[] {
  const monday = startOfWeek(anyDayISO);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "12–18 ноября" (или "26 октября – 1 ноября" при смене месяца). */
export function formatWeekRange(mondayISO: string): string {
  const start = parseISODate(mondayISO);
  const end = parseISODate(addDays(mondayISO, 6));
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_GEN[start.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_GEN[start.getMonth()]} – ${end.getDate()} ${MONTHS_GEN[end.getMonth()]}`;
}

/** День месяца без года: "Пн, 16". */
export function formatDayShort(iso: string): string {
  const d = parseISODate(iso);
  const label = DAY_LABELS[(d.getDay() + 6) % 7];
  return `${label}, ${d.getDate()}`;
}

/** Диапазон дат месяца: с 1-го числа по последнее. */
export function monthDates(monthISO: string): string[] {
  if (!isValidMonth(monthISO)) throw new Error(`Некорректный месяц: ${monthISO}`);
  const y = Number(monthISO.slice(0, 4));
  const m = Number(monthISO.slice(5, 7));
  const lastDay = new Date(y, m, 0, 12).getDate();
  return Array.from({ length: lastDay }, (_, i) => toISODate(new Date(y, m - 1, i + 1, 12)));
}

/** "Ноябрь 2026". */
export function formatMonth(monthISO: string): string {
  if (!isValidMonth(monthISO)) throw new Error(`Некорректный месяц: ${monthISO}`);
  const y = Number(monthISO.slice(0, 4));
  const m = Number(monthISO.slice(5, 7));
  return `${MONTHS_NOM[m - 1]} ${y}`;
}

export function shiftMonth(monthISO: string, n: number): string {
  if (!isValidMonth(monthISO)) throw new Error(`Некорректный месяц: ${monthISO}`);
  const y = Number(monthISO.slice(0, 4));
  const m = Number(monthISO.slice(5, 7));
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
