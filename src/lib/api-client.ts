// Клиентский API-слой: добавляет initData из Telegram к каждому запросу.

const INIT_DATA_HEADER = "x-telegram-init-data";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function tgInitData(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.Telegram?.WebApp?.initData ?? "";
  } catch {
    return "";
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const data = tgInitData();
  if (data) headers.set(INIT_DATA_HEADER, data);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(path, { ...init, headers, cache: "no-store" });
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // тело не JSON — оставляем общий текст
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}
