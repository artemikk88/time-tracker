"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeekNavProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  showToday: boolean;
  todayLabel?: string;
}

/** Навигация «← период →» с кнопкой возврата к текущему периоду. */
export function WeekNav({ label, onPrev, onNext, onToday, showToday, todayLabel = "Текущая" }: WeekNavProps) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onPrev} aria-label="Предыдущий период">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 truncate text-center text-sm font-medium" aria-live="polite">
          {label}
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onNext} aria-label="Следующий период">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {showToday && (
        <div className="mt-2 text-center">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onToday}>
            {todayLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
