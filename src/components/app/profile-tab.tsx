"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { toISODate } from "@/lib/dates";
import { MAX_RATE, MIN_RATE, formatHours, resolveWeeklyNorm } from "@/lib/hours";
import type { PublicUser, TeamMember } from "@/lib/types";

interface ProfileTabProps {
  user: PublicUser;
  isDemo: boolean;
  onUpdated: (user: PublicUser) => void;
}

const RATE_CHOICES = ["0.25", "0.5", "0.75", "1"];

export function ProfileTab({ user, isDemo, onUpdated }: ProfileTabProps) {
  const { toast } = useToast();
  const [position, setPosition] = useState(user.position ?? "");
  const [rateChoice, setRateChoice] = useState(() => rateToChoice(user.rate));
  const [customRate, setCustomRate] = useState(String(user.rate));
  const [normOverride, setNormOverride] = useState(user.weeklyNorm != null);
  const [normValue, setNormValue] = useState(
    user.weeklyNorm != null ? formatHours(user.weeklyNorm) : formatHours(user.resolvedNorm),
  );
  const [saving, setSaving] = useState(false);

  const [archived, setArchived] = useState<TeamMember[] | null>(null);

  const loadArchived = useCallback(() => {
    if (!user.isAdmin) return;
    api<{ users: TeamMember[] }>(`/api/team?archived=1&week=${toISODate(new Date())}`)
      .then((data) => setArchived(data.users))
      .catch(() => setArchived([]));
  }, [user.isAdmin]);

  useEffect(() => {
    loadArchived();
  }, [loadArchived]);

  function rateToChoiceEdit(value: string) {
    setRateChoice(rateToChoice(value));
    setCustomRate(value);
  }

  function normPreview(): string {
    const rate = currentRate();
    if (rate === null) return "—";
    const override = normOverride ? Number(normValue.replace(",", ".")) : null;
    if (normOverride && (!Number.isFinite(override) || (override ?? 0) < 0 || (override ?? 0) > 80)) return "—";
    return formatHours(resolveWeeklyNorm(rate, override));
  }

  function currentRate(): number | null {
    if (rateChoice !== "custom") return Number(rateChoice);
    const n = Number(customRate.replace(",", "."));
    if (!Number.isFinite(n) || n < MIN_RATE || n > MAX_RATE) return null;
    return n;
  }

  async function save() {
    const rate = currentRate();
    if (rate === null) {
      toast({
        title: "Проверьте ставку",
        description: `От ${MIN_RATE} до ${MAX_RATE}`,
        variant: "destructive",
      });
      return;
    }
    let weeklyNorm: number | null = null;
    if (normOverride) {
      const n = Number(normValue.replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 80) {
        toast({ title: "Проверьте норму", description: "От 0 до 80 ч в неделю", variant: "destructive" });
        return;
      }
      weeklyNorm = n;
    }
    setSaving(true);
    try {
      const resp = await api<{ user: PublicUser }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ position: position.trim(), rate, weeklyNorm }),
      });
      onUpdated(resp.user);
      toast({ title: "Профиль сохранён" });
    } catch (e) {
      toast({ title: "Не удалось сохранить", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function restore(member: TeamMember) {
    try {
      await api("/api/admin/archive", {
        method: "POST",
        body: JSON.stringify({ userId: member.id, archived: false }),
      });
      toast({ title: "Профиль возвращён", description: member.name });
      loadArchived();
    } catch (e) {
      toast({ title: "Ошибка", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-3 text-base">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {user.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{user.name}</span>
              {user.username && (
                <span className="block truncate text-xs font-normal text-muted-foreground">@{user.username}</span>
              )}
            </span>
            {isDemo && <Badge variant="outline" className="ml-auto shrink-0">демо-режим</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="position">Должность</Label>
            <Input
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Например: Разработчик"
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rate">Ставка</Label>
            <Select value={rateChoice} onValueChange={(v) => rateToChoiceEdit(v === "custom" ? "custom" : v)}>
              <SelectTrigger id="rate" className="w-full">
                <SelectValue placeholder="Выберите ставку" />
              </SelectTrigger>
              <SelectContent>
                {RATE_CHOICES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {formatHours(Number(r))} ставки
                  </SelectItem>
                ))}
                <SelectItem value="custom">Своя ставка…</SelectItem>
              </SelectContent>
            </Select>
            {rateChoice === "custom" && (
              <Input
                className="mt-2"
                type="number"
                inputMode="decimal"
                step="0.05"
                min={MIN_RATE}
                max={MAX_RATE}
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
                placeholder="Например: 0.3"
                aria-label="Своя ставка"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="norm-override">Своя недельная норма</Label>
              <p className="text-xs text-muted-foreground">По умолчанию: ставка × 40 ч</p>
            </div>
            <Switch
              id="norm-override"
              checked={normOverride}
              onCheckedChange={setNormOverride}
              aria-label="Своя недельная норма"
            />
          </div>
          {normOverride && (
            <div className="space-y-1.5">
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min={0}
                max={80}
                value={normValue}
                onChange={(e) => setNormValue(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
                aria-label="Норма часов в неделю"
              />
              {Number(normValue.replace(",", ".")) < 0 || Number(normValue.replace(",", ".")) > 80 ? (
                <p className="text-xs text-destructive">От 0 до 80 ч</p>
              ) : null}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Норма в неделю: <span className="font-medium text-foreground">{normPreview()} ч</span>
          </p>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Сохраняю…" : "Сохранить профиль"}
          </Button>
        </CardContent>
      </Card>

      {user.isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Администрирование</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Заархивированные профили</div>
              {archived === null ? (
                <p className="text-xs text-muted-foreground">Загрузка…</p>
              ) : archived.length === 0 ? (
                <p className="text-xs text-muted-foreground">Нет заархивированных профилей</p>
              ) : (
                <div className="divide-y">
                  {archived.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0 truncate text-sm">{m.name}</span>
                      <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => restore(m)}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        Вернуть
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Как это работает</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-2 text-sm text-muted-foreground">
          <p>1. Во вкладке «Неделя» проставьте часы по дням и нажмите «Сохранить».</p>
          <p>2. Коллеги и начальник видят ваши часы во вкладке «Команда» — только для чтения.</p>
          <p>3. Норма считается из ставки (ставка × 40 ч); свою норму можно задать здесь.</p>
          {isDemo && (
            <p className="rounded-md bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
              Демо-режим: приложение открыто вне Telegram. После подключения бота профиль будет
              автоматически привязан к вашему аккаунту Telegram.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function rateToChoice(rate: number): string {
  const s = formatHours(rate);
  return RATE_CHOICES.includes(s) ? s : "custom";
}
