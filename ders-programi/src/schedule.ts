// Ders programı veri tipi ve tarih yardımcıları (saf fonksiyonlar, test edilebilir).

export type Lesson = {
  id: string;
  course: string;
  /** 1 = Pazartesi … 7 = Pazar */
  day: number;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
  location?: string;
  teacher?: string;
  /** Programda saat yoksa: kaçıncı ders (1'den başlar). Saat, ders saatleri planından hesaplanır. */
  period?: number;
  /** Birleştirilmiş derslerde son ders numarası */
  periodEnd?: number;
};

/** Saat yazmayan programlar için okulun ders saati düzeni */
export type PeriodPlan = {
  firstStart: string;
  /** ders süresi (dk) */
  lesson: number;
  /** teneffüs (dk) */
  brk: number;
  /** kaçıncı dersten sonra öğle arası (0 = yok) */
  lunchAfter: number;
  /** öğle arası (dk) */
  lunch: number;
};
export const DEFAULT_PLAN: PeriodPlan = { firstStart: "08:30", lesson: 40, brk: 10, lunchAfter: 4, lunch: 40 };

const fromMinutes = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** n. dersin başlangıç ve bitiş saati */
export function periodTimes(plan: PeriodPlan, n: number): { start: string; end: string } {
  let t = toMinutes(normalizeTime(plan.firstStart) ?? DEFAULT_PLAN.firstStart);
  for (let i = 1; i < n; i++) t += plan.lesson + (plan.lunchAfter > 0 && i === plan.lunchAfter ? plan.lunch : plan.brk);
  return { start: fromMinutes(t), end: fromMinutes(t + plan.lesson) };
}

/** Ders numarası olan derslerin saatlerini plandan doldurur */
export function resolveTimes(l: Lesson, plan: PeriodPlan): Lesson {
  if (!l.period) return l;
  return { ...l, start: periodTimes(plan, l.period).start, end: periodTimes(plan, l.periodEnd ?? l.period).end };
}

export const periodLabel = (l: Lesson) =>
  l.period ? (l.periodEnd && l.periodEnd !== l.period ? `${l.period}.–${l.periodEnd}. ders` : `${l.period}. ders`) : "";

export const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const DAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

let counter = 0;
export const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** "8.30", "08:30", "830", "8" → "08:30"; geçersizse null */
export function normalizeTime(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/[.,;h]/g, ":");
  let h: number, m: number;
  let match = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (match) {
    h = +match[1];
    m = +match[2];
  } else if ((match = s.match(/^(\d{1,2})(\d{2})$/))) {
    h = +match[1];
    m = +match[2];
  } else if ((match = s.match(/^(\d{1,2})$/))) {
    h = +match[1];
    m = 0;
  } else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function lessonProblem(l: Lesson): string | null {
  if (!l.course.trim()) return "Ders adı boş";
  if (!(l.day >= 1 && l.day <= 7)) return "Gün seçilmedi";
  const s = normalizeTime(l.start);
  const e = normalizeTime(l.end);
  if (!s) return "Başlangıç saati geçersiz";
  if (!e) return "Bitiş saati geçersiz";
  if (toMinutes(e) <= toMinutes(s)) return "Bitiş, başlangıçtan sonra olmalı";
  return null;
}

export function sortLessons(list: Lesson[]): Lesson[] {
  return [...list].sort(
    (a, b) =>
      a.day - b.day ||
      (a.period && b.period ? a.period - b.period : 0) ||
      (normalizeTime(a.start) ?? "").localeCompare(normalizeTime(b.start) ?? ""),
  );
}

/**
 * Aynı gün, aynı ders ve aynı yerde arka arkaya gelen dersleri tek etkinlik yapar.
 * Ders numaralı programlarda ardışık numaralar birleşir (öğle arasının iki yanı hariç);
 * saatli programlarda aradaki teneffüs ≤ maxGap dk olmalı.
 */
export function mergeConsecutive(list: Lesson[], plan: PeriodPlan = DEFAULT_PLAN, maxGap = 15): Lesson[] {
  const norm = (x?: string) => (x ?? "").trim().toLocaleLowerCase("tr");
  const out: Lesson[] = [];
  for (const l of sortLessons(list)) {
    const prev = out[out.length - 1];
    const same = prev && prev.day === l.day && norm(prev.course) === norm(l.course) && norm(prev.location) === norm(l.location);
    if (same && prev.period && l.period) {
      const last = prev.periodEnd ?? prev.period;
      if (l.period === last + 1 && !(plan.lunchAfter > 0 && last === plan.lunchAfter)) {
        out[out.length - 1] = { ...prev, periodEnd: l.periodEnd ?? l.period };
        continue;
      }
    } else if (same && !prev.period && !l.period) {
      const s = normalizeTime(l.start);
      const pe = normalizeTime(prev.end);
      if (s && pe && toMinutes(s) - toMinutes(pe) >= 0 && toMinutes(s) - toMinutes(pe) <= maxGap) {
        out[out.length - 1] = { ...prev, end: l.end };
        continue;
      }
    }
    out.push({ ...l });
  }
  return out;
}

/** JS Date.getDay() (0=Pazar) → 1=Pazartesi…7=Pazar */
export const isoDay = (d: Date) => ((d.getDay() + 6) % 7) + 1;

/** termStart gününden itibaren, verilen haftanın gününe denk gelen ilk tarih ve saat */
export function firstOccurrence(termStart: Date, day: number, time: string): Date {
  const d = new Date(termStart.getFullYear(), termStart.getMonth(), termStart.getDate());
  d.setDate(d.getDate() + ((day - isoDay(d) + 7) % 7));
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** "26.11.2026" / "26/11/2026" / "2026-11-26" → Date (yerel); geçersizse null */
export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  let y: number, mo: number, d: number;
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else return null;
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export const formatDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

/** Dönem bitişi: başlangıç + hafta sayısı (son günün sonu) */
export function termEnd(termStart: Date, weeks: number): Date {
  const d = new Date(termStart.getFullYear(), termStart.getMonth(), termStart.getDate());
  d.setDate(d.getDate() + weeks * 7 - 1);
  d.setHours(23, 59, 0, 0);
  return d;
}

/** Bugünden sonraki ilk Pazartesi (bugün Pazartesi ise bugün) */
export function nextMonday(from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((8 - isoDay(d)) % 7));
  return d;
}
