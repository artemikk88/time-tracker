// Готовит окружение ДО импорта Prisma-клиента: отдельная тестовая БД, без BOT_TOKEN
// (чтобы сессии работали в демо-режиме).

import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));

process.env.DATABASE_URL = `file:${path.resolve(testsDir, "../db/test.db")}`;
delete process.env.BOT_TOKEN;
delete process.env.ADMIN_TELEGRAM_IDS;
