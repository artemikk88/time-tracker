import { errorResponse, getSession, toPublicUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDayShort, isValidMonth, monthDates } from "@/lib/dates";

export const dynamic = "force-dynamic";

// GET: история за месяц — по каждому сотруднику дни и итог. Просмотр доступен всем.
export async function GET(req: Request) {
  try {
    await getSession(req);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? "";
    if (!isValidMonth(month)) {
      return Response.json({ error: "Некорректный месяц" }, { status: 400 });
    }

    const days = monthDates(month);
    const from = days[0];
    const to = days[days.length - 1];

    const [users, entries] = await Promise.all([
      db.user.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
      db.dayEntry.findMany({
        where: { date: { gte: from, lte: to }, user: { archived: false } },
        orderBy: [{ userId: "asc" }, { date: "asc" }],
      }),
    ]);

    const result = users.map((u) => {
      const days = entries.filter((e) => e.userId === u.id);
      return {
        ...toPublicUser(u),
        total: days.reduce((acc, e) => acc + e.hours, 0),
        days: days.map((e) => ({
          date: e.date,
          dayLabel: formatDayShort(e.date),
          hours: e.hours,
          startTime: e.startTime,
          endTime: e.endTime,
        })),
      };
    });

    return Response.json({ month, users: result });
  } catch (e) {
    return errorResponse(e);
  }
}
