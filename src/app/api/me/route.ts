import { z } from "zod";
import { AuthError, errorResponse, getSession, toPublicUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_RATE, MIN_RATE } from "@/lib/hours";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { user, isDemo } = await getSession(req);
    return Response.json({ user: toPublicUser(user), isDemo });
  } catch (e) {
    return errorResponse(e);
  }
}

const patchSchema = z.object({
  position: z.string().trim().max(100).optional(),
  rate: z.number().min(MIN_RATE).max(MAX_RATE).optional(),
  // null = сбросить «свою норму», норма снова считается из ставки
  weeklyNorm: z.number().min(0).max(80).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const { user } = await getSession(req);
    if (user.archived) {
      throw new AuthError("Профиль заархивирован: редактирование недоступно", 403);
    }
    let body: z.infer<typeof patchSchema>;
    try {
      body = patchSchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Некорректные данные профиля" }, { status: 400 });
    }

    const data: { position?: string | null; rate?: number; weeklyNorm?: number | null } = {};
    if (body.position !== undefined) data.position = body.position === "" ? null : body.position;
    if (body.rate !== undefined) data.rate = body.rate;
    if (body.weeklyNorm !== undefined) data.weeklyNorm = body.weeklyNorm;

    const updated = await db.user.update({ where: { id: user.id }, data });
    return Response.json({ user: toPublicUser(updated) });
  } catch (e) {
    return errorResponse(e);
  }
}
