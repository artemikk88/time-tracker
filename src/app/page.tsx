"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock, History, RefreshCw, User, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryTab } from "@/components/app/history-tab";
import { ProfileTab } from "@/components/app/profile-tab";
import { TeamTab } from "@/components/app/team-tab";
import { WeekTab } from "@/components/app/week-tab";
import { useTelegramTheme } from "@/hooks/use-telegram";
import { api } from "@/lib/api-client";
import type { MeResponse } from "@/lib/types";

export default function Home() {
  useTelegramTheme();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRetrying(true);
    try {
      setMe(await api<MeResponse>("/api/me"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-8 pt-4">
        <header className="flex items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Учёт часов</h1>
              <p className="text-xs text-muted-foreground">
                {me ? me.user.name : "Загрузка…"}
              </p>
            </div>
          </div>
          {me?.isDemo && <Badge variant="outline" className="shrink-0">демо-режим</Badge>}
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Не удалось загрузить профиль</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>{error}</span>
              <Button variant="outline" size="sm" className="w-fit" onClick={load} disabled={retrying}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                {retrying ? "Пробую…" : "Повторить"}
              </Button>
            </AlertDescription>
          </Alert>
        ) : !me ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <Tabs defaultValue="week" className="w-full">
            <TabsList className="grid h-11 w-full grid-cols-4">
              <TabsTrigger value="week" className="flex flex-col items-center gap-0.5 px-1 text-[11px] leading-none">
                <CalendarDays className="h-4 w-4" />
                Неделя
              </TabsTrigger>
              <TabsTrigger value="team" className="flex flex-col items-center gap-0.5 px-1 text-[11px] leading-none">
                <Users className="h-4 w-4" />
                Команда
              </TabsTrigger>
              <TabsTrigger value="history" className="flex flex-col items-center gap-0.5 px-1 text-[11px] leading-none">
                <History className="h-4 w-4" />
                История
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex flex-col items-center gap-0.5 px-1 text-[11px] leading-none">
                <User className="h-4 w-4" />
                Профиль
              </TabsTrigger>
            </TabsList>
            <TabsContent value="week" className="mt-3">
              <WeekTab user={me.user} />
            </TabsContent>
            <TabsContent value="team" className="mt-3">
              <TeamTab user={me.user} />
            </TabsContent>
            <TabsContent value="history" className="mt-3">
              <HistoryTab />
            </TabsContent>
            <TabsContent value="profile" className="mt-3">
              <ProfileTab
                user={me.user}
                isDemo={me.isDemo}
                onUpdated={(u) => setMe((prev) => (prev ? { ...prev, user: u } : prev))}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
