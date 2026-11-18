import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyInitData } from "@/lib/telegram";

const BOT_TOKEN = "123456:TEST-BOT-TOKEN";
const FRESH_AUTH_DATE = Math.floor(Date.now() / 1000);

interface TestUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

/** Строит initData, подписанный по официальному алгоритму Telegram. */
function makeInitData(user: TestUser, botToken = BOT_TOKEN, authDate = FRESH_AUTH_DATE): string {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAF-test",
    user: JSON.stringify(user),
  });
  const pairs = [...params.keys()].sort().map((key) => `${key}=${params.get(key) ?? ""}`);
  const dataCheckString = pairs.join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  params.append("hash", hash);
  return params.toString();
}

describe("verifyInitData", () => {
  const user: TestUser = { id: 777000123, first_name: "Иван", last_name: "Петров", username: "ivan_p" };

  it("принимает корректно подписанные данные", () => {
    const verified = verifyInitData(makeInitData(user), BOT_TOKEN);
    expect(verified).not.toBeNull();
    expect(verified?.user.id).toBe(user.id);
    expect(verified?.user.username).toBe("ivan_p");
  });

  it("отклоняет подделанные данные", () => {
    const data = makeInitData(user);
    const tampered = data.replace("ivan_p", "hacker");
    expect(verifyInitData(tampered, BOT_TOKEN)).toBeNull();
  });

  it("отклоняет подпись другим токеном", () => {
    expect(verifyInitData(makeInitData(user, "1:OTHER"), BOT_TOKEN)).toBeNull();
  });

  it("отклоняет устаревший auth_date (>24 ч)", () => {
    const stale = FRESH_AUTH_DATE - 25 * 60 * 60;
    expect(verifyInitData(makeInitData(user, BOT_TOKEN, stale), BOT_TOKEN)).toBeNull();
  });

  it("отклоняет данные без hash, user или пустые", () => {
    expect(verifyInitData("auth_date=123", BOT_TOKEN)).toBeNull();
    expect(verifyInitData("auth_date=123&hash=abc", BOT_TOKEN)).toBeNull();
    expect(verifyInitData("", BOT_TOKEN)).toBeNull();
    expect(verifyInitData(makeInitData(user), "")).toBeNull();
  });
});
