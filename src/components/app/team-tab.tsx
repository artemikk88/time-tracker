"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronUp } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekNav } from "@/components/app/week-nav";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DAY_LABELS, addDays, formatDayShort, formatWeekRange, startOfWeek, toISODate } from "@/lib/dates";
import { formatHours, formatTimeRange, normStatus } from "@/lib/hours";
import type { DayEntryDto, PublicUser, TeamMember } from "@/lib/types";

interface TeamTabProps {
  user: PublicUser;
}

export function TeamTab({ user }: TeamTabProps) {
  const { toast } = useToast();
  const [offset, setOffset] = useState(0);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const monday = useMemo(() => addDays(startOfWeek(toISODate(new Date())), offset * 7), [offset]);
  const loaded = loadedWeek === monday;

  useEffect(() => {
    let cancelled = false;
    api<{ users: TeamMember[] }>(`/api/team?week=${monday}`)
      .then((data) => {
        if (cancelled) return;
        setMembers(data.users);
        setLoadedWeek(monday);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        toast({ title: "Не удалось загрузить команду", description: e.message, variant: "destructive" });
        setLoadedWeek(monday);
      });
    return () => {
      cancelled = true;
    };
  }, [monday, reloadKey, toast]);

  async function archiveMember(member: TeamMember, archived: boolean) {
    try {
      await api("/api/admin/archive", {
        method: "POST",
        body: JSON.stringify({ userId: member.id, archived }),
      });
      toast({ title: archived ? "Профиль заархивирован" : "Профиль возвращён", description: member.name });
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast({ title: "Ошибка", description: (e as Error).message, variant: "destructive" });
    }
  }

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

          <div className="mt-3 divide-y">
            {!loaded
              ? Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                    <Skeleton className="h-5 w-14" />
                  </div>
                ))
              : members.length === 0
                ? <p className="py-6 text-center text-sm text-muted-foreground">Пока нет сотрудников</p>
                : members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      isSelf={m.id === user.id}
                      monday={monday}
                      expanded={expandedId === m.id}
                      onToggle={() => setExpandedId((id) => (id === m.id ? null : m.id))}
                      canArchive={user.isAdmin && m.id !== user.id}
                      onArchive={() => archiveMember(m, true)}
                    />
                  ))}
          </div>
        </CardContent>
      </Card>
      <p className="px-1 text-xs text-muted-foreground">
        Нажмите на сотрудника, чтобы увидеть его часы по дням. Данные только для чтения.
      </p>
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  monday,
  expanded,
  onToggle,
  canArchive,
  onArchive,
}: {
  member: TeamMember;
  isSelf: boolean;
  monday: string;
  expanded: boolean;
  onToggle: () => void;
  canArchive: boolean;
  onArchive: () => void;
}) {
  const { toast } = useToast();
  const [days, setDays] = useState<DayEntryDto[] | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    api<{ entries: DayEntryDto[] }>(
      `/api/hours?userId=${member.id}&from=${monday}&to=${addDays(monday, 6)}`,
    )
      .then((data) => {
        if (cancelled) return;
        setDays(data.entries);
        setLoadedFor(monday);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        toast({ title: "Не удалось загрузить часы", description: e.message, variant: "destructive" });
        setLoadedFor(monday);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, member.id, monday, toast]);

  const detailLoading = expanded && (days === null || loadedFor !== monday);
  const status = normStatus(member.weekTotal, member.resolvedNorm);
  const initial = member.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-2 text-left"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{member.name}</span>
              {isSelf && <Badge variant="secondary" className="shrink-0">вы</Badge>}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {member.position ?? "Должность не указана"} · {formatHours(member.rate)} ставки
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={
                status === "ok"
                  ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                  : status === "under"
                    ? "text-sm font-semibold text-amber-600 dark:text-amber-400"
                    : "text-sm font-semibold"
              }
            >
              {formatHours(member.weekTotal)} ч
            </div>
            <div className="text-xs text-muted-foreground">из {formatHours(member.resolvedNorm)} ч</div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
        {canArchive && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label={`Архивировать ${member.name}`}>
                <Archive className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Заархивировать «{member.name}»?</AlertDialogTitle>
                <AlertDialogDescription>
                  Профиль исчезнет из команды и истории, часы сохранятся. Вернуть можно во вкладке «Профиль».
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={onArchive}>Заархивировать</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {expanded && (
        <div className="ml-[52px] border-l-2 pl-3">
          {detailLoading ? (
            <div className="flex gap-1 py-2">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="aspect-square w-full max-w-12 rounded-md" />
              ))}
            </div>
          ) : days !== null && days.length > 0 ? (
            /* Неделя сотрудника: квадратами, как во вкладке «Неделя», + список диапазонов */
            <>
              <div className="grid grid-cols-7 gap-1 py-2">
                {Array.from({ length: 7 }, (_, i) => {
                  const date = addDays(monday, i);
                  const entry = days.find((d) => d.date === date);
                  const hours = entry && entry.hours > 0 ? entry.hours : null;
                  const range = entry ? formatTimeRange(entry.startTime, entry.endTime) : null;
                  return (
                    <div
                      key={date}
                      title={`${formatDayShort(date)}: ${
                        hours === null
                          ? "не отмечено"
                          : range
                            ? `${range} (${formatHours(hours)} ч)`
                            : `${formatHours(hours)} ч`
                      }`}
                      className={cn(
                        "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md",
                        hours !== null
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/70 text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "text-[9px] font-medium uppercase leading-none",
                          hours !== null ? "text-primary-foreground/75" : "text-muted-foreground",
                        )}
                      >
                        {DAY_LABELS[i]}
                      </span>
                      <span className="text-xs font-bold leading-none">
                        {hours === null ? "—" : formatHours(hours)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-0.5 pb-2 text-xs">
                {days
                  .filter((d) => d.hours > 0)
                  .map((d) => {
                    const range = formatTimeRange(d.startTime, d.endTime);
                    return (
                      <div key={d.date} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{formatDayShort(d.date)}</span>
                        <span className="font-medium">
                          {range ? `${range} · ${formatHours(d.hours)} ч` : `${formatHours(d.hours)} ч`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">Часы за эту неделю не отмечены</p>
          )}
        </div>
      )}
    </div>
  );
}
