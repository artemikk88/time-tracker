import { z } from "zod";
import { AuthError, errorResponse, getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  userId: z.string().min(1),
  archived: z.boolean(),
});

// POST: архивировать/вернуть профиль сотрудника. Только администратор.
export async function POST(req: Request) {
  try {
    const { user } = await getSession(req);
    if (!user.isAdmin) {
      throw new AuthError("Действие доступно только администратору", 403);
    }

    let body: z.infer<typeof postSchema>;
    try {
      body = postSchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    if (body.userId === user.id && body.archived) {
      return Response.json({ error: "Нельзя заархивировать свой профиль" }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id: body.userId } });
    if (!target) return Response.json({ error: "Сотрудник не найден" }, { status: 404 });

    await db.user.update({ where: { id: body.userId }, data: { archived: body.archived } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
