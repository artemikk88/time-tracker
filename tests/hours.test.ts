import { describe, expect, it } from "vitest";
import {
  BASE_WEEK_HOURS,
  formatTimeRange,
  hoursFromRange,
  isValidHours,
  normStatus,
  resolveWeeklyNorm,
  roundToStep,
  sumHours,
} from "@/lib/hours";

describe("isValidHours", () => {
  it("пропускает корректные значения с шагом 0.5", () => {
    for (const v of [0, 0.5, 1, 7.5, 12]) {
      expect(isValidHours(v)).toBe(true);
    }
  });

  it("отклоняет всё вне диапазона или не кратно 0.5", () => {
    for (const v of [12.5, 0.25, 7.3, -1, 13, NaN, Infinity, "8", null, undefined]) {
      expect(isValidHours(v as unknown as number)).toBe(false);
    }
  });
});

describe("roundToStep", () => {
  it("округляет к ближайшим 0.5", () => {
    expect(roundToStep(7.3)).toBe(7.5);
    expect(roundToStep(7.2)).toBe(7);
    expect(roundToStep(0.26)).toBe(0.5);
    expect(roundToStep(0.24)).toBe(0);
    expect(roundToStep(12.9)).toBe(13); // дальше клампит вызывающий код
  });
});

describe("resolveWeeklyNorm", () => {
  it("норма = ставка × 40", () => {
    expect(BASE_WEEK_HOURS).toBe(40);
    expect(resolveWeeklyNorm(0.5, null)).toBe(20);
    expect(resolveWeeklyNorm(1, null)).toBe(40);
    expect(resolveWeeklyNorm(0.25, null)).toBe(10);
  });

  it("переопределение нормы имеет приоритет", () => {
    expect(resolveWeeklyNorm(0.5, 24)).toBe(24);
    expect(resolveWeeklyNorm(1, 0)).toBe(0);
  });
});

describe("normStatus", () => {
  it("зелёный при норме и больше, жёлтый — меньше, серый — пусто", () => {
    expect(normStatus(20, 20)).toBe("ok");
    expect(normStatus(22, 20)).toBe("ok");
    expect(normStatus(19.5, 20)).toBe("under");
    expect(normStatus(0, 20)).toBe("empty");
  });
});

describe("sumHours", () => {
  it("складывает часы недели", () => {
    expect(sumHours([{ hours: 8 }, { hours: 4.5 }, { hours: 0 }, { hours: 7.5 }])).toBeCloseTo(20);
  });
});

describe("hoursFromRange", () => {
  it("считает обычную смену", () => {
    expect(hoursFromRange("09:00", "17:00")).toBe(8);
    expect(hoursFromRange("9:00", "17:00")).toBe(8); // час без ведущего нуля
  });

  it("считает смену с получасом", () => {
    expect(hoursFromRange("09:00", "17:30")).toBe(8.5);
    expect(hoursFromRange("08:45", "17:15")).toBe(8.5);
  });

  it("округляет длительность до шага 0.5", () => {
    // 8 ч 10 мин -> 8
    expect(hoursFromRange("09:10", "17:20")).toBe(8);
    // 8 ч 20 мин -> 8.5
    expect(hoursFromRange("09:10", "17:30")).toBe(8.5);
  });

  it("поддерживает ночную смену через полночь", () => {
    expect(hoursFromRange("22:00", "02:00")).toBe(4);
    expect(hoursFromRange("23:30", "07:30")).toBe(8);
  });

  it("отклоняет диапазон больше 12 ч", () => {
    expect(hoursFromRange("09:00", "22:00")).toBeNull();
    // одинаковое время считается как 24 ч — тоже вне лимита
    expect(hoursFromRange("09:00", "09:00")).toBeNull();
    expect(hoursFromRange("00:00", "00:00")).toBeNull();
  });

  it("отклоняет длительность меньше 0.5 ч", () => {
    expect(hoursFromRange("09:00", "09:10")).toBeNull();
    expect(hoursFromRange("09:00", "09:14")).toBeNull();
  });

  it("отклоняет неполный или некорректный ввод", () => {
    expect(hoursFromRange("", "17:00")).toBeNull();
    expect(hoursFromRange("09:00", "")).toBeNull();
    expect(hoursFromRange("25:00", "17:00")).toBeNull();
    expect(hoursFromRange("09:60", "17:00")).toBeNull();
    expect(hoursFromRange("9:0", "17:00")).toBeNull();
    expect(hoursFromRange("900", "1700")).toBeNull();
  });
});

describe("formatTimeRange", () => {
  it("форматирует сохранённый диапазон через тире", () => {
    expect(formatTimeRange("09:00", "17:30")).toBe("09:00–17:30");
    expect(formatTimeRange("22:00", "02:00")).toBe("22:00–02:00");
  });

  it("возвращает null без диапазона или с мусором", () => {
    expect(formatTimeRange(null, null)).toBeNull();
    expect(formatTimeRange("09:00", null)).toBeNull();
    expect(formatTimeRange("", "")).toBeNull();
    expect(formatTimeRange("09:00", "25:00")).toBeNull();
    expect(formatTimeRange("9", "17:00")).toBeNull();
  });
});
