// Демо-режим: работает, когда приложение открыто в обычном браузере (без Telegram).
// Наполняет базу тестовой командой, чтобы разделы «Команда» и «История» не были пустыми.

import { db } from "@/lib/db";
import { addDays, startOfWeek, toISODate } from "@/lib/dates";

const DEMO_USER_ID = "demo-user";
const TEAMMATES = [
  { telegramId: "demo-anna", name: "Анна Смирнова", username: "anna_s", position: "Менеджер", rate: 0.5, pattern: [4, 4, 0, 4, 4, 0, 0] },
  { telegramId: "demo-petr", name: "Пётр Козлов", username: "petr_k", position: "Разработчик", rate: 0.25, pattern: [2, 3, 0, 4, 3, 0, 0] },
  { telegramId: "demo-maria", name: "Мария Иванова", username: "maria_i", position: "Дизайнер", rate: 1.0, pattern: [8, 7, 8, 8, 7, 0, 0] },
];
// Паттерн демо-пользователя чередуется по неделям, чтобы индикатор нормы менялся.
const DEMO_PATTERNS = [
  [6, 4, 0, 4, 6, 0, 0], // 20 ч — ровно норма при 0.5
  [4, 2, 4, 0, 4, 0, 0], // 14 ч — ниже нормы
  [8, 6, 4, 2, 0, 0, 0], // 20 ч
  [4, 4, 4, 4, 4, 0, 0], // 20 ч
];

/** Создаёт демо-команду и часы за последние 5 недель. Идемпотентно. */
export async function seedDemoIfNeeded(): Promise<void> {
  const existing = await db.user.count({ where: { telegramId: { startsWith: "demo-" } } });
  if (existing > 0) return;

  const today = new Date();
  const thisMonday = startOfWeek(toISODate(today));
  // 5 недель: две прошлые, текущая и две будущие (как «проставить вперёд»)
  const mondays = [-2, -1, 0, 1, 2].map((w) => addDays(thisMonday, w * 7));

  for (let mi = 0; mi < mondays.length; mi++) {
    const monday = mondays[mi];
    const demoPattern = DEMO_PATTERNS[mi % DEMO_PATTERNS.length];
    for (const mate of TEAMMATES) {
      await createUserWithWeek(mate.telegramId, mate, monday, rotate(mate.pattern, mi));
    }
    await createUserWithWeek(
      DEMO_USER_ID,
      { telegramId: DEMO_USER_ID, name: "Демо Сотрудник", username: "demo_user", position: "Разработчик", rate: 0.5 },
      monday,
      demoPattern,
    );
  }
}

function rotate<T>(arr: T[], n: number): T[] {
  const shift = n % arr.length;
  return [...arr.slice(arr.length - shift), ...arr.slice(0, arr.length - shift)];
}

// Рабочий день у демо-команды начинается по-разному, чтобы диапазоны выглядели живыми.
const START_TIMES = ["08:30", "09:00", "09:30", "10:00", "08:00"];

/** "09:00" + 8.5 ч -> "17:30" (без перехода через полночь: демо-смены короткие). */
function timeAfter(start: string, hours: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = (h * 60 + m + Math.round(hours * 60)) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function createUserWithWeek(
  telegramId: string,
  profile: { name: string; username: string; position: string; rate: number },
  monday: string,
  pattern: number[],
): Promise<void> {
  const user = await db.user.upsert({
    where: { telegramId },
    update: {},
    create: {
      telegramId,
      name: profile.name,
      username: profile.username,
      position: profile.position,
      rate: profile.rate,
      isAdmin: telegramId === DEMO_USER_ID,
    },
  });
  const data = pattern
    .map((hours, i) => {
      const start = hours > 0 ? START_TIMES[i % START_TIMES.length] : null;
      return {
        date: addDays(monday, i),
        hours,
        startTime: start,
        endTime: start ? timeAfter(start, hours) : null,
      };
    })
    .filter((e) => e.hours > 0)
    .map((e) => ({
      userId: user.id,
      date: e.date,
      hours: e.hours,
      startTime: e.startTime,
      endTime: e.endTime,
    }));
  if (data.length === 0) return;
  await db.dayEntry.createMany({ data });
}
