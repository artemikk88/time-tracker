// Минимальные типы Telegram WebApp API (только то, что используется в приложении).

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; last_name?: string; username?: string } };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(eventType: string, callback: () => void): void;
  offEvent?(eventType: string, callback: () => void): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export {};
