import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDayShort,
  formatMonth,
  formatWeekRange,
  isValidISODate,
  isValidMonth,
  monthDates,
  parseISODate,
  shiftMonth,
  startOfWeek,
  toISODate,
  weekDates,
} from "@/lib/dates";

describe("isValidISODate", () => {
  it("принимает корректные даты", () => {
    expect(isValidISODate("2026-11-16")).toBe(true);
    expect(isValidISODate("2024-02-29")).toBe(true); // високосный год
  });

  it("отклоняет мусор и несуществующие даты", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("2026-00-10")).toBe(false);
    expect(isValidISODate("16.11.2026")).toBe(false);
    expect(isValidISODate("2026-11-16x")).toBe(false);
    expect(isValidISODate("")).toBe(false);
  });
});

describe("startOfWeek", () => {
  it("возвращает понедельник недели (среда -> понедельник)", () => {
    expect(startOfWeek("2026-11-18")).toBe("2026-11-16");
  });

  it("воскресенье относится к предыдущей неделе", () => {
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09");
  });

  it("понедельник не меняется", () => {
    expect(startOfWeek("2026-11-16")).toBe("2026-11-16");
  });

  it("переход через границу месяца и года", () => {
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26"); // воскресенье
    expect(startOfWeek("2027-01-01")).toBe("2026-12-28"); // пятница
  });
});

describe("weekDates", () => {
  it("возвращает 7 дней Пн..Вс", () => {
    const days = weekDates("2026-11-18");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-11-16");
    expect(days[6]).toBe("2026-11-22");
  });
});

describe("addDays", () => {
  it("переносит через конец месяца", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("работает с отрицательным смещением", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("monthDates и shiftMonth", () => {
  it("обычный февраль — 28 дней, високосный — 29", () => {
    expect(monthDates("2026-02")).toHaveLength(28);
    expect(monthDates("2024-02")).toHaveLength(29);
  });

  it("сдвиг месяца через границу года", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("отклоняет некорректный месяц", () => {
    expect(() => monthDates("2026-13")).toThrow();
    expect(isValidMonth("2026-11")).toBe(true);
    expect(isValidMonth("2026-00")).toBe(false);
  });
});

describe("форматирование", () => {
  it("formatWeekRange внутри одного месяца", () => {
    expect(formatWeekRange("2026-11-16")).toBe("16–22 ноября");
  });

  it("formatWeekRange через границу месяцев", () => {
    expect(formatWeekRange("2026-10-26")).toBe("26 октября – 1 ноября");
  });

  it("formatMonth", () => {
    expect(formatMonth("2026-11")).toBe("Ноябрь 2026");
  });

  it("formatDayShort", () => {
    expect(formatDayShort("2026-11-16")).toBe("Пн, 16");
    expect(formatDayShort("2026-11-22")).toBe("Вс, 22");
  });
});

describe("toISODate / parseISODate — согласованные туда-обратно", () => {
  it("parse(toISO(d)) сохраняет дату", () => {
    const d = new Date(2026, 10, 16, 9, 30);
    expect(toISODate(d)).toBe("2026-11-16");
    expect(parseISODate("2026-11-16").getDate()).toBe(16);
  });
});
