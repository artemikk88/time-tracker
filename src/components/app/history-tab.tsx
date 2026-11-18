"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekNav } from "@/components/app/week-nav";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { formatMonth, shiftMonth, toISODate } from "@/lib/dates";
import { formatHours, formatTimeRange } from "@/lib/hours";
import type { HistoryUser } from "@/lib/types";

export function HistoryTab() {
  const { toast } = useToast();
  const [month, setMonth] = useState(() => toISODate(new Date()).slice(0, 7));
  const [users, setUsers] = useState<HistoryUser[]>([]);
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentMonth = toISODate(new Date()).slice(0, 7);
  const loaded = loadedMonth === month;

  useEffect(() => {
    let cancelled = false;
    api<{ users: HistoryUser[] }>(`/api/history?month=${month}`)
      .then((data) => {
        if (cancelled) return;
        setUsers(data.users);
        setLoadedMonth(month);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        toast({ title: "Не удалось загрузить историю", description: e.message, variant: "destructive" });
        setLoadedMonth(month);
      });
    return () => {
      cancelled = true;
    };
  }, [month, toast]);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <WeekNav
            label={formatMonth(month)}
            onPrev={() => setMonth((m) => shiftMonth(m, -1))}
            onNext={() => setMonth((m) => shiftMonth(m, 1))}
            onToday={() => setMonth(currentMonth)}
            showToday={month !== currentMonth}
            todayLabel="Текущий месяц"
          />

          <div className="mt-3 divide-y">
            {!loaded
              ? Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="ml-auto h-4 w-14" />
                  </div>
                ))
              : users.length === 0
                ? <p className="py-6 text-center text-sm text-muted-foreground">Нет данных за этот месяц</p>
                : users.map((u) => (
                    <div key={u.id} className="py-1">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md py-2.5 text-left"
                        onClick={() => setExpandedId((id) => (id === u.id ? null : u.id))}
                        aria-expanded={expandedId === u.id}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{u.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {u.position ?? "Должность не указана"} · {u.days.length} раб. дн.
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-semibold">{formatHours(u.total)} ч</div>
                      </button>
                      {expandedId === u.id && (
                        <div className="ml-1 border-l-2 pb-2 pl-3">
                          {u.days.length === 0 ? (
                            <p className="py-2 text-xs text-muted-foreground">Часов за месяц нет</p>
                          ) : (
                            <div className="space-y-1 py-2">
                              {u.days.map((d) => {
                                const range = formatTimeRange(d.startTime, d.endTime);
                                return (
                                  <div key={d.date} className="flex justify-between gap-2 text-sm">
                                    <span className="text-muted-foreground">{d.dayLabel}</span>
                                    <span className="text-right font-medium">
                                      {range ? (
                                        <>
                                          <span className="text-muted-foreground">{range} · </span>
                                          {formatHours(d.hours)} ч
                                        </>
                                      ) : (
                                        `${formatHours(d.hours)} ч`
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
