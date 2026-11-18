import { z } from "zod";
import { AuthError, errorResponse, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidISODate, parseISODate } from "@/lib/dates";
import { hoursFromRange, isValidHours } from "@/lib/hours";

export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 31;

function rangeDays(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000) + 1;
}

// GET: часы сотрудника за период. Читать можно любого (только чтение), менять — только свои.
export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || session.user.id;
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";

    if (!isValidISODate(from) || !isValidISODate(to)) {
      return Response.json({ error: "Некорректный период" }, { status: 400 });
    }
    if (rangeDays(from, to) > 93) {
      return Response.json({ error: "Слишком большой период" }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) return Response.json({ error: "Сотрудник не найден" }, { status: 404 });

    const entries = await db.dayEntry.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
    return Response.json({
      entries: entries.map((e) => ({
        date: e.date,
        hours: e.hours,
        startTime: e.startTime,
        endTime: e.endTime,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

// Строка времени либо null (пустая строка тоже считается отсутствием).
const timeField = z
  .string()
  .max(5)
  .nullish()
  .transform((v) => {
    const s = v?.trim() ?? "";
    return s === "" ? null : s;
  });

const putSchema = z.object({
  from: z.string(),
  to: z.string(),
  entries: z
    .array(
      z.object({
        date: z.string(),
        startTime: timeField,
        endTime: timeField,
        hours: z.number().nullish(), // запасной вариант для старых записей без диапазона
      }),
    )
    .min(1)
    .max(MAX_RANGE_DAYS),
});

// PUT: сохранить неделю. Основной формат записи — диапазон времени («09:00»–«17:30»),
// часы сервер считает сам. Записи без диапазона (но с hours) сохраняют старое поведение
// «просто часы»; полностью пустая запись удаляет день.
export async function PUT(req: Request) {
  try {
    const { user } = await getSession(req);
    if (user.archived) {
      throw new AuthError("Профиль заархивирован: редактирование недоступно", 403);
    }

    let body: z.infer<typeof putSchema>;
    try {
      body = putSchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Некорректный формат данных" }, { status: 400 });
    }

    const { from, to, entries } = body;
    if (!isValidISODate(from) || !isValidISODate(to)) {
      return Response.json({ error: "Некорректный период" }, { status: 400 });
    }
    if (rangeDays(from, to) > MAX_RANGE_DAYS) {
      return Response.json({ error: "Слишком большой период" }, { status: 400 });
    }

    const seen = new Set<string>();
    for (const entry of entries) {
      if (!isValidISODate(entry.date) || entry.date < from || entry.date > to) {
        return Response.json({ error: `Дата ${entry.date} вне выбранного периода` }, { status: 400 });
      }
      if (seen.has(entry.date)) {
        return Response.json({ error: `Дата ${entry.date} указана дважды` }, { status: 400 });
      }
      seen.add(entry.date);

      const { startTime, endTime } = entry;
      if ((startTime === null) !== (endTime === null)) {
        return Response.json(
          { error: `День ${entry.date}: укажите и начало, и конец диапазона` },
          { status: 400 },
        );
      }
    }

    // hours считаем только после проверки формата всех записей
    const resolved = entries.map((entry) => {
      if (entry.startTime && entry.endTime) {
        const hours = hoursFromRange(entry.startTime, entry.endTime);
        if (hours === null) {
          return { ...entry, hours: null as number | null };
        }
        return { ...entry, hours };
      }
      // без диапазона: hours из запроса (совместимость со старыми записями) или 0
      return { ...entry, hours: entry.hours ?? 0 };
    });

    for (const entry of resolved) {
      if (entry.startTime && entry.endTime && !isValidHours(entry.hours)) {
        return Response.json(
          {
            error: `День ${entry.date}: диапазон должен давать от 0 до 12 ч с шагом 0.5 (ночная смена — через 00:00)`,
          },
          { status: 400 },
        );
      }
      if (!entry.startTime && !entry.endTime && entry.hours !== 0 && !isValidHours(entry.hours)) {
        return Response.json(
          { error: "Часы должны быть от 0 до 12, с шагом 0.5" },
          { status: 400 },
        );
      }
    }

    await db.$transaction([
      ...resolved.map((entry) =>
        entry.hours === 0
          ? db.dayEntry.deleteMany({ where: { userId: user.id, date: entry.date } })
          : db.dayEntry.upsert({
              where: { userId_date: { userId: user.id, date: entry.date } },
              update: {
                hours: entry.hours,
                startTime: entry.startTime,
                endTime: entry.endTime,
              },
              create: {
                userId: user.id,
                date: entry.date,
                hours: entry.hours,
                startTime: entry.startTime,
                endTime: entry.endTime,
              },
            }),
      ),
      // Дни внутри периода, не присланные в этом сохранении, обнуляем
      db.dayEntry.deleteMany({
        where: { userId: user.id, date: { gte: from, lte: to, notIn: [...seen] } },
      }),
    ]);

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
