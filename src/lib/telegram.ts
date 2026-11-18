// Валидация initData из Telegram Mini App (HMAC-SHA256 по токену бота).
// Алгоритм по официальной документации: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

import { createHmac, timingSafeEqual } from "crypto";

export interface TelegramUserPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface VerifiedInitData {
  user: TelegramUserPayload;
  authDate: number;
}

/** secret = HMAC_SHA256(key="WebAppData", message=BOT_TOKEN) */
function secretKey(botToken: string): Buffer {
  return createHmac("sha256", "WebAppData").update(botToken).digest();
}

/**
 * Проверяет подпись initData и свежесть auth_date.
 * Возвращает null, если данные не прошли проверку.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60,
): VerifiedInitData | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  // data-check-string: все поля кроме hash, отсортированные по ключу
  const pairs: string[] = [];
  const sortedKeys = [...params.keys()].filter((k) => k !== "hash").sort();
  for (const key of sortedKeys) {
    pairs.push(`${key}=${params.get(key) ?? ""}`);
  }
  const dataCheckString = pairs.join("\n");

  const calculated = createHmac("sha256", secretKey(botToken)).update(dataCheckString).digest("hex");
  const a = Buffer.from(calculated, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > maxAgeSeconds) return null;

  const rawUser = params.get("user");
  if (!rawUser) return null;
  let user: TelegramUserPayload;
  try {
    user = JSON.parse(rawUser) as TelegramUserPayload;
  } catch {
    return null;
  }
  if (!user || typeof user.id !== "number") return null;

  return { user, authDate };
}
