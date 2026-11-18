// Сессия: идентификация по Telegram initData, иначе демо-режим.
// Сервер не доверяет клиенту: имя и isAdmin берутся из initData/окружения, не из запроса.

import { type User } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyInitData, type TelegramUserPayload } from "@/lib/telegram";
import { seedDemoIfNeeded } from "@/lib/demo";
import { resolveWeeklyNorm } from "@/lib/hours";
import type { PublicUser } from "@/lib/types";

export const INIT_DATA_HEADER = "x-telegram-init-data";
const DEMO_TELEGRAM_ID = "demo-user";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
  ) {
    super(message);
  }
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    position: u.position,
    rate: u.rate,
    weeklyNorm: u.weeklyNorm,
    resolvedNorm: resolveWeeklyNorm(u.rate, u.weeklyNorm),
    isAdmin: u.isAdmin,
    archived: u.archived,
  };
}

/** Telegram id админов из env (ADMIN_TELEGRAM_IDS="123,456"). Читается на каждый вызов — легко менять. */
function adminTelegramIds(): Set<string> {
  const raw = process.env.ADMIN_TELEGRAM_IDS?.trim() ?? "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

async function upsertTelegramUser(payload: TelegramUserPayload): Promise<User> {
  const telegramId = String(payload.id);
  const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim() || "Сотрудник";
  const username = payload.username ?? null;
  const adminIds = adminTelegramIds();

  const existing = await db.user.findUnique({ where: { telegramId } });
  if (existing) {
    // Имя/username обновляем из Telegram; админство синхронизируем только если список задан явно
    return db.user.update({
      where: { id: existing.id },
      data: {
        name,
        username,
        ...(adminIds.size > 0 ? { isAdmin: adminIds.has(telegramId) } : {}),
      },
    });
  }

  // Если список админов не задан — первый вошедший (тот, кто настраивал бота) становится админом
  const isFirst = (await db.user.count()) === 0;
  return db.user.create({
    data: {
      telegramId,
      name,
      username,
      isAdmin: adminIds.size > 0 ? adminIds.has(telegramId) : isFirst,
    },
  });
}

export interface Session {
  user: User;
  isDemo: boolean;
}

/** Определяет текущего пользователя по заголовку initData, иначе возвращает демо-пользователя. */
export async function getSession(req: Request): Promise<Session> {
  const initData = req.headers.get(INIT_DATA_HEADER)?.trim();
  const botToken = process.env.BOT_TOKEN?.trim();

  if (initData && botToken) {
    const verified = verifyInitData(initData, botToken);
    if (!verified) {
      throw new AuthError("Не удалось подтвердить данные Telegram. Откройте приложение через меню бота.");
    }
    const user = await upsertTelegramUser(verified.user);
    return { user, isDemo: false };
  }

  if (botToken && !initData) {
    throw new AuthError("Требуется авторизация Telegram: откройте приложение через меню бота.");
  }

  // Демо-режим: BOT_TOKEN не задан, открыто в обычном браузере
  await seedDemoIfNeeded();
  const user = await db.user.findUnique({ where: { telegramId: DEMO_TELEGRAM_ID } });
  if (!user) throw new AuthError("Демо-режим недоступен", 500);
  return { user, isDemo: true };
}

/** Единая обработка ошибок для роутов. */
export function errorResponse(e: unknown): Response {
  if (e instanceof AuthError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error("[api]", e);
  return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
}
