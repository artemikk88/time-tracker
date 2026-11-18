// Интеграционные тесты API: работают с реальной SQLite-тестовой БД (db/test.db).
// Запуск: bun run test:prepare && bun run test

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getMe, PATCH as patchMe } from "@/app/api/me/route";
import { GET as getHours, PUT as putHours } from "@/app/api/hours/route";
import { GET as getTeam } from "@/app/api/team/route";
import { GET as getHistory } from "@/app/api/history/route";
import { POST as postArchive } from "@/app/api/admin/archive/route";
import { db } from "@/lib/db";
import { addDays, monthDates } from "@/lib/dates";
import type { PublicUser, TeamMember } from "@/lib/types";

const WEEK_MONDAY = "2026-11-16";
const WEEK_SUNDAY = "2026-11-22";
const MONTH = "2026-11";

function jsonRequest(path: string, method: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getRequest(path: string): Request {
  return new Request(`http://localhost${path}`);
}

let me: PublicUser;

async function teamUsers(): Promise<TeamMember[]> {
  const res = await getTeam(getRequest(`/api/team?week=${WEEK_MONDAY}`));
  expect(res.status).toBe(200);
  return (await res.json()).users as TeamMember[];
}

beforeAll(async () => {
  await db.dayEntry.deleteMany({});
  await db.user.deleteMany({});
});

afterAll(async () => {
  await db.$disconnect();
});

describe("GET /api/me — демо-сессия", () => {
  it("создаёт демо-пользователя с нормой из ставки", async () => {
    const res = await getMe(getRequest("/api/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    me = body.user;
    expect(body.isDemo).toBe(true);
    expect(me.rate).toBe(0.5);
    expect(me.resolvedNorm).toBe(20);
    expect(me.isAdmin).toBe(true);
  });

  it("демо-команда засеяна: Анна, Пётр, Мария", async () => {
    const users = await teamUsers();
    const names = users.map((u) => u.name);
    expect(names).toContain("Анна Смирнова");
    expect(names).toContain("Пётр Козлов");
    expect(names).toContain("Мария Иванова");
    expect(names).toContain("Демо Сотрудник");
  });
});

describe("PATCH /api/me — профиль", () => {
  it("обновляет должность, ставку и свою норму", async () => {
    const res = await patchMe(
      jsonRequest("/api/me", "PATCH", { position: "Разработчик", rate: 0.25, weeklyNorm: 24 }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.position).toBe("Разработчик");
    expect(body.user.resolvedNorm).toBe(24); // своя норма приоритетнее
  });

  it("сброс своей нормы возвращает норму из ставки", async () => {
    const res = await patchMe(jsonRequest("/api/me", "PATCH", { rate: 0.5, weeklyNorm: null }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.weeklyNorm).toBeNull();
    expect(body.user.resolvedNorm).toBe(20);
  });

  it("отклоняет некорректную ставку", async () => {
    const res = await patchMe(jsonRequest("/api/me", "PATCH", { rate: 5 }));
    expect(res.status).toBe(400);
  });
});

describe("PUT/GET /api/hours — сохранение недели", () => {
  it("сохраняет диапазоны времени и считает часы сам, пустые дни не хранятся", async () => {
    const res = await putHours(
      jsonRequest("/api/hours", "PUT", {
        from: WEEK_MONDAY,
        to: WEEK_SUNDAY,
        entries: [
          { date: "2026-11-16", startTime: "09:00", endTime: "17:00" }, // 8 ч
          { date: "2026-11-17", startTime: "09:00", endTime: "13:30" }, // 4.5 ч
          { date: "2026-11-18", startTime: null, endTime: null }, // день без работы
          { date: "2026-11-22", startTime: "22:00", endTime: "02:00" }, // ночная смена, 4 ч
        ],
      }),
    );
    expect(res.status).toBe(200);

    const read = await getHours(getRequest(`/api/hours?from=${WEEK_MONDAY}&to=${WEEK_SUNDAY}`));
    const body = await read.json();
    const byDate = new Map<string, { date: string; hours: number; startTime: string | null; endTime: string | null }>(
      body.entries.map((e: { date: string }) => [e.date, e]),
    );
    expect(byDate.get("2026-11-16")).toEqual({
      date: "2026-11-16",
      hours: 8,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(byDate.get("2026-11-17")?.hours).toBe(4.5);
    expect(byDate.get("2026-11-22")).toEqual({
      date: "2026-11-22",
      hours: 4,
      startTime: "22:00",
      endTime: "02:00",
    });
    expect(byDate.has("2026-11-18")).toBe(false); // пустой день удалён
    expect(body.entries).toHaveLength(3);
  });

  it("повторное сохранение заменяет данные недели целиком", async () => {
    const res = await putHours(
      jsonRequest("/api/hours", "PUT", {
        from: WEEK_MONDAY,
        to: WEEK_SUNDAY,
        entries: [{ date: "2026-11-16", startTime: "10:00", endTime: "16:00" }],
      }),
    );
    expect(res.status).toBe(200);
    const read = await getHours(getRequest(`/api/hours?from=${WEEK_MONDAY}&to=${WEEK_SUNDAY}`));
    const body = await read.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toEqual({
      date: "2026-11-16",
      hours: 6,
      startTime: "10:00",
      endTime: "16:00",
    });
  });

  it("принимает запись «просто часы» без диапазона (совместимость со старыми данными)", async () => {
    const res = await putHours(
      jsonRequest("/api/hours", "PUT", {
        from: WEEK_MONDAY,
        to: WEEK_SUNDAY,
        entries: [
          { date: "2026-11-16", startTime: "09:00", endTime: "17:00" },
          { date: "2026-11-19", hours: 5 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const read = await getHours(getRequest(`/api/hours?from=${WEEK_MONDAY}&to=${WEEK_SUNDAY}`));
    const body = await read.json();
    expect(body.entries).toHaveLength(2); // Пн с диапазоном + Чт «просто часы»
    expect(body.entries.find((e: { date: string }) => e.date === "2026-11-19")).toEqual({
      date: "2026-11-19",
      hours: 5,
      startTime: null,
      endTime: null,
    });
    // запись с диапазоном не потерялась
    expect(body.entries.find((e: { date: string }) => e.date === "2026-11-16")?.startTime).toBe("09:00");
  });

  it("читать чужие часы можно, а мои сохранения их не трогают", async () => {
    const users = await teamUsers();
    const anna = users.find((u) => u.name === "Анна Смирнова")!;
    const before = await (
      await getHours(getRequest(`/api/hours?userId=${anna.id}&from=${WEEK_MONDAY}&to=${WEEK_SUNDAY}`))
    ).json();

    expect(before.entries.length).toBeGreaterThan(0); // часы Анны засеяны

    // Сохраняем свою неделю — это не должно влиять на данные Анны
    const put = await putHours(
      jsonRequest("/api/hours", "PUT", {
        from: WEEK_MONDAY,
        to: WEEK_SUNDAY,
        entries: [{ date: "2026-11-16", startTime: "09:00", endTime: "12:00" }],
      }),
    );
    expect(put.status).toBe(200);

    const after = await (
      await getHours(getRequest(`/api/hours?userId=${anna.id}&from=${WEEK_MONDAY}&to=${WEEK_SUNDAY}`))
    ).json();
    expect(after.entries).toEqual(before.entries);
  });

  it("отклоняет диапазоны вне лимитов, половинки и даты вне периода", async () => {
    const cases: unknown[] = [
      { from: WEEK_MONDAY, to: WEEK_SUNDAY, entries: [{ date: "2026-11-16", startTime: "09:00", endTime: "22:00" }] }, // 13 ч > 12
      { from: WEEK_MONDAY, to: WEEK_SUNDAY, entries: [{ date: "2026-11-16", startTime: "09:00", endTime: "09:14" }] }, // < 0.5 ч
      { from: WEEK_MONDAY, to: WEEK_SUNDAY, entries: [{ date: "2026-11-16", startTime: "09:00", endTime: "09:00" }] }, // «24 ч»
      { from: WEEK_MONDAY, to: WEEK_SUNDAY, entries: [{ date: "2026-11-16", startTime: "09:00" }] }, // нет конца
      { from: WEEK_MONDAY, to: WEEK_SUNDAY, entries: [{ date: "2026-11-16", endTime: "18:00" }] }, // нет начала
      { from: WEEK_MONDAY, to: WEEK_SUNDAY, entries: [{ date: "2026-11-16", startTime: "25:00", endTime: "26:00" }] }, // кривое время
      { from: WEEK_MONDAY, to: WEEK_SUNDAY, entries: [{ date: "2026-11-10", startTime: "09:00", endTime: "13:00" }] }, // вне периода
      { from: WEEK_MONDAY, to: WEEK_SUNDAY, entries: [{ date: "2026-02-30", startTime: "09:00", endTime: "13:00" }] }, // нет такой даты
      { from: WEEK_MONDAY, to: WEEK_SUNDAY, entries: [] },
    ];
    for (const body of cases) {
      const res = await putHours(jsonRequest("/api/hours", "PUT", body));
      expect(res.status).toBe(400);
    }
  });

  it("отклоняет период больше 31 дня", async () => {
    const res = await putHours(
      jsonRequest("/api/hours", "PUT", {
        from: "2026-01-01",
        to: "2026-03-01",
        entries: [{ date: "2026-01-05", startTime: "09:00", endTime: "13:00" }],
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/team — суммы за неделю", () => {
  it("считает weekTotal демо-пользователя после сохранения", async () => {
    // Перезапишем неделю заранее известным значением, чтобы тест не зависел от порядка
    const put = await putHours(
      jsonRequest("/api/hours", "PUT", {
        from: WEEK_MONDAY,
        to: WEEK_SUNDAY,
        entries: [
          { date: "2026-11-16", startTime: "08:00", endTime: "12:00" }, // 4 ч
          { date: "2026-11-17", startTime: "10:00", endTime: "12:00" }, // 2 ч
        ],
      }),
    );
    expect(put.status).toBe(200);

    const users = await teamUsers();
    const demo = users.find((u) => u.id === me.id)!;
    expect(demo.weekTotal).toBe(6);
    expect(demo.resolvedNorm).toBe(20);
  });
});

describe("GET /api/history и архивация", () => {
  it("месячный итог совпадает с данными БД", async () => {
    const res = await getHistory(getRequest(`/api/history?month=${MONTH}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    const demo = (body.users as { id: string; total: number; days: unknown[] }[]).find((u) => u.id === me.id)!;
    const monthDays = monthDates(MONTH);
    const dbEntries = await db.dayEntry.findMany({
      where: { userId: me.id, date: { gte: monthDays[0], lte: monthDays[monthDays.length - 1] } },
    });
    const dbTotal = dbEntries.reduce((acc, e) => acc + e.hours, 0);
    expect(demo.total).toBe(dbTotal);
    expect(demo.days.length).toBe(dbEntries.filter((e) => e.hours > 0).length);
  });

  it("заархивированный сотрудник исчезает из команды и истории", async () => {
    const users = await teamUsers();
    const petr = users.find((u) => u.name === "Пётр Козлов")!;
    expect(petr).toBeDefined();

    const arch = await postArchive(jsonRequest("/api/admin/archive", "POST", { userId: petr.id, archived: true }));
    expect(arch.status).toBe(200);

    const afterArchive = await teamUsers();
    expect(afterArchive.find((u) => u.id === petr.id)).toBeUndefined();

    const history = await getHistory(getRequest(`/api/history?month=${MONTH}`));
    const historyBody = await history.json();
    expect((historyBody.users as { id: string }[]).find((u) => u.id === petr.id)).toBeUndefined();
  });

  it("архивировать себя нельзя, вернуть профиль можно", async () => {
    const selfArchive = await postArchive(jsonRequest("/api/admin/archive", "POST", { userId: me.id, archived: true }));
    expect(selfArchive.status).toBe(400);

    const users = await teamUsers();
    const petr = (await db.user.findUnique({ where: { telegramId: "demo-petr" } }))!;
    const restore = await postArchive(jsonRequest("/api/admin/archive", "POST", { userId: petr.id, archived: false }));
    expect(restore.status).toBe(200);
    expect((await teamUsers()).find((u) => u.id === petr.id)).toBeDefined();
  });
});
