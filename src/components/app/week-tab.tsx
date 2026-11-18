"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekNav } from "@/components/app/week-nav";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DAY_LABELS, addDays, formatDayShort, formatWeekRange, startOfWeek, toISODate, weekDates } from "@/lib/dates";
import { MAX_DAY_HOURS, formatHours, formatTimeRange, hoursFromRange, normStatus, sumHours } from "@/lib/hours";
import type { DayEntryDto, PublicUser } from "@/lib/types";

interface WeekTabProps {
  user: PublicUser;
}

/** Состояние ввода одного дня: диапазон времени. legacyHours — часы из БД
 * для старых записей без диапазона (пока день не отредактирован заново). */
interface DayInput {
  start: string;
  end: string;
  legacyHours: number | null;
}

const EMPTY_DAY: DayInput = { start: "", end: "", legacyHours: null };

/** Часы дня: диапазон -> расчёт, оба поля пустых -> 0 (или старые часы из БД),
 * заполнена только половина диапазона -> null (ошибка). */
function hoursOf(day: DayInput): number | null {
  if (day.start && day.end) return hoursFromRange(day.start, day.end);
  if (!day.start && !day.end) return day.legacyHours ?? 0;
  return null;
}

/** Тело записи для PUT: диапазон — основной формат, старые записи сохраняют «просто часы». */
function entryOf(date: string, day: DayInput): { date: string; startTime?: string; endTime?: string; hours?: number } {
  if (day.start && day.end) return { date, startTime: day.start, endTime: day.end };
  if (!day.start && !day.end && (day.legacyHours ?? 0) > 0) return { date, hours: day.legacyHours };
  return { date };
}

export function WeekTab({ user }: WeekTabProps) {
  const { toast } = useToast();
  const [offset, setOffset] = useState(0);
  const [values, setValues] = useState<Record<string, DayInput>>({});
  const [savedValues, setSavedValues] = useState<Record<string, DayInput>>({});
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const monday = useMemo(
    // текущая неделя — по часовому поясу сотрудника (в браузере)
    () => addDays(startOfWeek(toISODate(new Date())), offset * 7),
    [offset],
  );
  const days = useMemo(() => weekDates(monday), [monday]);
  const loaded = loadedWeek === monday;
  const today = toISODate(new Date());

  // При смене недели выбираем «сегодня» (если оно в этой неделе), иначе понедельник.
  useEffect(() => {
    setSelected(days.includes(today) ? today : monday);
  }, [monday]);

  useEffect(() => {
    let cancelled = false;
    api<{ entries: DayEntryDto[] }>(`/api/hours?from=${monday}&to=${addDays(monday, 6)}`)
      .then(({ entries }) => {
        if (cancelled) return;
        const next: Record<string, DayInput> = {};
        for (const d of days) next[d] = EMPTY_DAY;
        for (const e of entries) {
          const hasRange = Boolean(e.startTime && e.endTime);
          next[e.date] = {
            start: e.startTime ?? "",
            end: e.endTime ?? "",
            legacyHours: hasRange ? null : e.hours,
          };
        }
        setValues(next);
        setSavedValues(next);
        setLoadedWeek(monday);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        toast({ title: "Не удалось загрузить часы", description: e.message, variant: "destructive" });
        setValues((prev) => {
          const next = { ...prev };
          for (const d of days) if (next[d] === undefined) next[d] = EMPTY_DAY;
          return next;
        });
        setLoadedWeek(monday);
      });
    return () => {
      cancelled = true;
    };
  }, [monday, days, toast]);

  const parsed = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const d of days) map[d] = hoursOf(values[d] ?? EMPTY_DAY);
    return map;
  }, [values, days]);

  const allValid = days.every((d) => parsed[d] !== null);
  const total = sumHours(days.map((d) => ({ hours: parsed[d] ?? 0 })));
  const status = normStatus(total, user.resolvedNorm);
  const dirty = days.some(
    (d) =>
      (values[d]?.start ?? "") !== (savedValues[d]?.start ?? "") ||
      (values[d]?.end ?? "") !== (savedValues[d]?.end ?? "") ||
      (values[d]?.legacyHours ?? null) !== (savedValues[d]?.legacyHours ?? null),
  );

  function setRange(date: string, part: "start" | "end", value: string) {
    setValues((prev) => ({ ...prev, [date]: { ...(prev[date] ?? EMPTY_DAY), [part]: value } }));
  }

  function clearSelected() {
    if (!selected) return;
    // legacyHours тоже сбрасываем: после очистки день сохранится как «без работы»
    setValues((prev) => ({ ...prev, [selected]: { start: "", end: "", legacyHours: null } }));
  }

  async function save() {
    if (!allValid) {
      toast({
        title: "Проверьте диапазоны времени",
        description: `Каждый день должен давать от 0.5 до ${MAX_DAY_HOURS} ч или быть пустым`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await api("/api/hours", {
        method: "PUT",
        body: JSON.stringify({
          from: monday,
          to: addDays(monday, 6),
          entries: days.map((d) => entryOf(d, values[d] ?? EMPTY_DAY)),
        }),
      });
      setSavedValues({ ...values });
      toast({ title: "Сохранено", description: `Часы на ${formatWeekRange(monday)} сохранены` });
    } catch (e) {
      toast({ title: "Не удалось сохранить", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const selectedDay = selected ? (values[selected] ?? EMPTY_DAY) : EMPTY_DAY;
  const selectedParsed = selected ? parsed[selected] : null;
  const selectedRange = formatTimeRange(selectedDay.start, selectedDay.end);
  const selectedInvalid = selectedParsed === null;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <WeekNav
            label={formatWeekRange(monday)}
            onPrev={() => setOffset((o) => o - 1)}
            onNext={() => setOffset((o) => o + 1)}
            onToday={() => setOffset(0)}
            showToday={offset !== 0}
          />

          {!loaded ? (
            <>
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {days.map((d) => (
                  <Skeleton key={d} className="aspect-square rounded-lg" />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-8 w-44" />
              </div>
            </>
          ) : (
            <>
              {/* Неделя: 7 квадратных плиток; заполненные — фирменный синий */}
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {days.map((d, i) => {
                  const value = parsed[d];
                  const filled = (value ?? 0) > 0;
                  const invalid = value === null;
                  const isSelected = selected === d;
                  const isToday = d === today;
                  const day = values[d] ?? EMPTY_DAY;
                  const range = formatTimeRange(day.start, day.end);
                  const label = invalid
                    ? "ошибка ввода"
                    : filled
                      ? range
                        ? `${formatHours(value)} ч (${range})`
                        : `${formatHours(value)} ч`
                      : "не отмечено";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelected(d)}
                      aria-pressed={isSelected}
                      aria-label={`${formatDayShort(d)}: ${label}`}
                      className={cn(
                        "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-center transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        filled
                          ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-border bg-secondary/70 text-secondary-foreground hover:bg-secondary",
                        isSelected && invalid === false && "ring-2 ring-ring ring-offset-2 ring-offset-card",
                        invalid && "ring-2 ring-destructive ring-offset-2 ring-offset-card",
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] font-medium uppercase leading-none tracking-wide",
                          filled ? "text-primary-foreground/75" : "text-muted-foreground",
                        )}
                      >
                        {DAY_LABELS[i]}
                      </span>
                      <span className="text-base font-semibold leading-none">{Number(d.slice(8, 10))}</span>
                      <span
                        className={cn(
                          "text-xs font-bold leading-none",
                          filled ? "" : "text-muted-foreground/60",
                        )}
                      >
                        {invalid ? "!" : filled ? formatHours(value) : "—"}
                      </span>
                      {isToday && (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                            filled ? "bg-primary-foreground" : "bg-primary",
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Ввод для выбранного дня: диапазон времени — основной способ */}
              <div className="mt-3 rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-16 text-sm font-medium">
                    {selected ? formatDayShort(selected) : "—"}
                    {selectedParsed !== null && selectedParsed > 0 && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {formatHours(selectedParsed)} ч
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
                    onClick={clearSelected}
                    disabled={!selected || (!selectedDay.start && !selectedDay.end && !selectedDay.legacyHours)}
                    aria-label="Очистить день"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Очистить
                  </Button>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    type="time"
                    className="h-9 w-[104px] shrink-0 text-center"
                    value={selectedDay.start}
                    onChange={(e) => selected && setRange(selected, "start", e.target.value)}
                    disabled={!selected}
                    aria-label={selected ? `Начало работы, ${formatDayShort(selected)}` : "Начало работы"}
                  />
                  <span aria-hidden className="shrink-0 text-muted-foreground">
                    –
                  </span>
                  <Input
                    type="time"
                    className="h-9 w-[104px] shrink-0 text-center"
                    value={selectedDay.end}
                    onChange={(e) => selected && setRange(selected, "end", e.target.value)}
                    disabled={!selected}
                    aria-label={selected ? `Конец работы, ${formatDayShort(selected)}` : "Конец работы"}
                  />
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold",
                      selectedInvalid ? "text-destructive" : "text-muted-foreground/60",
                    )}
                  >
                    {selectedInvalid ? "?" : selectedRange ?? "0 ч"}
                  </span>
                </div>
                {selectedInvalid ? (
                  <p className="mt-2 text-xs text-destructive">
                    Диапазон должен давать от 0.5 до {MAX_DAY_HOURS} ч (ночная смена — через 00:00).
                    Пустые поля — день без работы.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Например, 09:00–18:00 — это 9 ч. Ночная смена (22:00–06:00) тоже считается.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-sm text-muted-foreground">Итого:</span>
              <span className="whitespace-nowrap text-lg font-semibold">{formatHours(total)} ч</span>
              <Badge
                className={
                  status === "ok"
                    ? "bg-emerald-600 text-white hover:bg-emerald-600"
                    : status === "under"
                      ? "bg-amber-500 text-white hover:bg-amber-500"
                      : ""
                }
                variant={status === "empty" ? "secondary" : "default"}
              >
                норма {formatHours(user.resolvedNorm)} ч
              </Badge>
            </div>
            <Button onClick={save} disabled={!loaded || !dirty || saving || !allValid} className="min-w-28">
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Сохраняю…" : "Сохранить"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <p className="px-1 text-xs text-muted-foreground">
        Синий квадрат — день с часами. Время вводится диапазоном «начало–конец»: часы считаются
        сами и показываются в команде и истории. Пустые поля — день без работы. Коллеги видят
        данные только для чтения.
      </p>
    </div>
  );
}
