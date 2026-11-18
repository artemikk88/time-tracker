// Типы, общие для сервера и клиента (без прisma-импортов).

export interface PublicUser {
  id: string;
  name: string;
  username: string | null;
  position: string | null;
  rate: number;
  weeklyNorm: number | null;
  resolvedNorm: number;
  isAdmin: boolean;
  archived: boolean;
}

export interface MeResponse {
  user: PublicUser;
  isDemo: boolean;
}

export interface TeamMember extends PublicUser {
  weekTotal: number;
}

export interface HistoryDay {
  date: string;
  dayLabel: string;
  hours: number;
  startTime: string | null; // "HH:MM"; null — старая запись «просто часы»
  endTime: string | null;
}

export interface HistoryUser extends PublicUser {
  total: number;
  days: HistoryDay[];
}

/** Запись дня из GET /api/hours (и для своей недели, и для чужой в «Команде»). */
export interface DayEntryDto {
  date: string;
  hours: number;
  startTime: string | null;
  endTime: string | null;
}
