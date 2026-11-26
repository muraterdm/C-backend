import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { Lesson } from "./schedule";

const KEY_API = "gemini_api_key";
const KEY_LESSONS = "lessons_v1";
const KEY_EVENTS = "added_events_v1";
const KEY_SETTINGS = "settings_v1";

export const getApiKey = async () => (await SecureStore.getItemAsync(KEY_API)) ?? "";
export const setApiKey = (key: string) =>
  key ? SecureStore.setItemAsync(KEY_API, key) : SecureStore.deleteItemAsync(KEY_API);

async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const setJson = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

export const loadLessons = () => getJson<Lesson[]>(KEY_LESSONS, []);
export const saveLessons = (l: Lesson[]) => setJson(KEY_LESSONS, l);

/** Uygulamanın takvime eklediği etkinliklerin kimlikleri (geri almak için) */
export const loadAddedEvents = () => getJson<string[]>(KEY_EVENTS, []);
export const saveAddedEvents = (ids: string[]) => setJson(KEY_EVENTS, ids);

export type Settings = { weeks: number; reminder: number; merge: boolean; calendarId?: string };
export const DEFAULT_SETTINGS: Settings = { weeks: 14, reminder: 10, merge: true };
export const loadSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await getJson<Partial<Settings>>(KEY_SETTINGS, {})) });
export const saveSettings = (s: Settings) => setJson(KEY_SETTINGS, s);
