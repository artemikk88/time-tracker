"use client";

import { useEffect, useState } from "react";
import type { TelegramWebApp } from "@/types/telegram";

export function getWebApp(): TelegramWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.Telegram?.WebApp;
  } catch {
    return undefined;
  }
}

/**
 * Инициализирует Telegram Mini App (ready/expand) и синхронизирует тему:
 * внутри Telegram — colorScheme из клиента, в браузере — системная.
 */
export function useTelegramTheme(): "light" | "dark" {
  const [scheme, setScheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const wa = getWebApp();
    wa?.ready();
    wa?.expand();

    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const apply = () => {
      // colorScheme доверяем только внутри настоящего Telegram (initData непуст):
      // в обычном браузере скрипт telegram-web-app.js тоже определяет WebApp,
      // но всегда с colorScheme: 'light', что перекрывало бы системную тему.
      const insideTelegram = Boolean(wa?.initData);
      const next: "light" | "dark" = insideTelegram
        ? (wa?.colorScheme ?? "light")
        : media?.matches
          ? "dark"
          : "light";
      setScheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };

    apply();
    wa?.onEvent?.("themeChanged", apply);
    media?.addEventListener?.("change", apply);
    return () => {
      wa?.offEvent?.("themeChanged", apply);
      media?.removeEventListener?.("change", apply);
    };
  }, []);

  return scheme;
}
