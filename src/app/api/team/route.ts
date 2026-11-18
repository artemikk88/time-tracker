import { errorResponse, getSession, toPublicUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, isValidISODate, startOfWeek } from "@/lib/dates";
import { sumHours } from "@/lib/hours";

export const dynamic = "force-dynamic";

// GET: команда с суммами часов за неделю. Просмотр доступен всем, редактирование — нет.
export async function GET(req: Request) {
  try {
    await getSession(req);
    const { searchParams } = new URL(req.url);
    const weekParam = searchParams.get("week");
    if (!weekParam || !isValidISODate(weekParam)) {
      return Response.json({ error: "Некорректная дата недели" }, { status: 400 });
    }

    const monday = startOfWeek(weekParam);
    const to = addDays(monday, 6);
    const archivedOnly = searchParams.get("archived") === "1";

    const [users, entries] = await Promise.all([
      db.user.findMany({ where: { archived: archivedOnly }, orderBy: { name: "asc" } }),
      db.dayEntry.findMany({ where: { date: { gte: monday, lte: to } } }),
    ]);

    const totals = new Map<string, number>();
    for (const entry of entries) {
      totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + entry.hours);
    }

    return Response.json({
      week: monday,
      users: users.map((u) => ({ ...toPublicUser(u), weekTotal: sumHours([{ hours: totals.get(u.id) ?? 0 }]) })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
