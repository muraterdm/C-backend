// Telefonun kendi takvimine (iOS Takvim / Google Takvim) haftalık tekrarlayan etkinlik ekler.
// "legacy" API kullanılıyor: Expo Go'da da çalışır.
import * as Calendar from "expo-calendar/legacy";
import { Platform } from "react-native";
import { Lesson, firstOccurrence, normalizeTime, termEnd } from "./schedule";

export type WritableCalendar = { id: string; title: string; account?: string; color?: string; isDefault: boolean };

export async function ensurePermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.granted) return true;
  const req = await Calendar.requestCalendarPermissionsAsync();
  return req.granted;
}

export async function listWritableCalendars(): Promise<WritableCalendar[]> {
  const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  let defaultId: string | undefined;
  if (Platform.OS === "ios") {
    try {
      defaultId = (await Calendar.getDefaultCalendarAsync()).id;
    } catch {}
  }
  const writable = all.filter(
    c =>
      c.allowsModifications &&
      (Platform.OS !== "android" ||
        [Calendar.CalendarAccessLevel.OWNER, Calendar.CalendarAccessLevel.CONTRIBUTOR, Calendar.CalendarAccessLevel.EDITOR, Calendar.CalendarAccessLevel.ROOT].includes(
          c.accessLevel as Calendar.CalendarAccessLevel,
        )),
  );
  if (!defaultId) defaultId = (writable.find(c => c.isPrimary) ?? writable.find(c => /@gmail\.com$/.test(c.ownerAccount ?? "")) ?? writable[0])?.id;
  return writable
    .map(c => ({
      id: c.id,
      title: c.title,
      account: Platform.OS === "ios" ? c.source?.name : c.ownerAccount ?? c.source?.name,
      color: c.color,
      isDefault: c.id === defaultId,
    }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

export type AddOptions = { calendarId: string; termStart: Date; weeks: number; reminderMinutes: number };

export async function addLessons(lessons: Lesson[], opts: AddOptions): Promise<string[]> {
  const until = termEnd(opts.termStart, opts.weeks);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ids: string[] = [];
  for (const l of lessons) {
    const start = firstOccurrence(opts.termStart, l.day, normalizeTime(l.start)!);
    const end = firstOccurrence(opts.termStart, l.day, normalizeTime(l.end)!);
    const notes = [l.teacher && `Öğretmen: ${l.teacher}`, "Ders Programı uygulamasıyla eklendi"].filter(Boolean).join("\n");
    const id = await Calendar.createEventAsync(opts.calendarId, {
      title: l.course,
      startDate: start,
      endDate: end,
      location: l.location || undefined,
      notes,
      timeZone,
      alarms: opts.reminderMinutes > 0 ? [{ relativeOffset: -opts.reminderMinutes, method: Calendar.AlarmMethod.ALERT }] : [],
      recurrenceRule: { frequency: Calendar.Frequency.WEEKLY, interval: 1, endDate: until },
    });
    ids.push(id);
  }
  return ids;
}

/** Daha önce eklenen etkinlikleri (tüm tekrarlarıyla) siler; silinemeyen kimlikleri döner. */
export async function removeEvents(ids: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await Calendar.deleteEventAsync(id, { futureEvents: true });
    } catch {
      try {
        await Calendar.deleteEventAsync(id);
      } catch {
        // Kullanıcı etkinliği zaten elle silmiş olabilir; tekrar denemeye gerek yok.
        try {
          await Calendar.getEventAsync(id);
          failed.push(id);
        } catch {}
      }
    }
  }
  return failed;
}
