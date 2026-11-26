import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { addLessons, ensurePermission, listWritableCalendars, removeEvents, WritableCalendar } from "./src/calendar";
import { readSchedule } from "./src/gemini";
import {
  DAY_NAMES,
  DAY_SHORT,
  Lesson,
  formatDate,
  lessonProblem,
  mergeConsecutive,
  newId,
  nextMonday,
  normalizeTime,
  parseDate,
  PeriodPlan,
  periodLabel,
  periodTimes,
  resolveTimes,
  sortLessons,
  termEnd,
} from "./src/schedule";
import * as store from "./src/storage";

const C = {
  bg: "#F4F6FB",
  card: "#FFFFFF",
  text: "#1B2333",
  muted: "#6B7385",
  primary: "#3559E0",
  primarySoft: "#E6ECFD",
  danger: "#D64545",
  border: "#E1E5EE",
  warn: "#B7791F",
  warnSoft: "#FFF6E5",
};
const REMINDERS = [0, 5, 10, 15, 30, 60];

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />
        <Main />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Main() {
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKeyState] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const [photo, setPhoto] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editing, setEditing] = useState<Lesson | null>(null);

  const [settings, setSettings] = useState<store.Settings>(store.DEFAULT_SETTINGS);
  const [startText, setStartText] = useState(formatDate(new Date()));
  const [calendars, setCalendars] = useState<WritableCalendar[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedIds, setAddedIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [k, l, s, a] = await Promise.all([store.getApiKey(), store.loadLessons(), store.loadSettings(), store.loadAddedEvents()]);
      setApiKeyState(k);
      setKeyDraft(k);
      setLessons(l);
      setSettings(s);
      setAddedIds(a);
      setShowSettings(!k);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) store.saveLessons(lessons);
  }, [lessons, ready]);
  useEffect(() => {
    if (ready) store.saveSettings(settings);
  }, [settings, ready]);

  const finalLessons = useMemo(() => sortLessons(lessons.map(l => resolveTimes(l, settings.plan))), [lessons, settings.plan]);
  const maxPeriod = Math.max(0, ...lessons.map(l => l.periodEnd ?? l.period ?? 0));
  const setPlan = (patch: Partial<PeriodPlan>) => setSettings(s => ({ ...s, plan: { ...s.plan, ...patch } }));
  const problems = finalLessons.filter(l => lessonProblem(l));
  const termStart = parseDate(startText);

  async function saveKey() {
    const k = keyDraft.trim();
    if (k && !/^AIza[\w-]{20,}$/.test(k)) {
      Alert.alert("Anahtar tanınmadı", "Gemini anahtarları genellikle “AIza” ile başlar. Yine de kaydedildi.");
    }
    await store.setApiKey(k);
    setApiKeyState(k);
    if (k) setShowSettings(false);
  }

  async function pick(source: "camera" | "library") {
    if (!apiKey) {
      setShowSettings(true);
      Alert.alert("API anahtarı gerekli", "Önce ücretsiz Gemini API anahtarını gir.");
      return;
    }
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("İzin gerekli", source === "camera" ? "Kamera izni verilmedi." : "Fotoğraflara erişim izni verilmedi.");
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, base64: true, allowsEditing: false };
    const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    setPhoto(asset.uri);
    setNotes(null);
    setReading(true);
    try {
      const mime = asset.mimeType && /^image\/(jpeg|png|webp|heic|heif)$/.test(asset.mimeType) ? asset.mimeType : "image/jpeg";
      const out = await readSchedule(apiKey, asset.base64!, mime);
      setNotes(out.notes ?? null);
      if (!out.lessons.length) {
        Alert.alert("Ders bulunamadı", out.notes ?? "Fotoğrafta ders programı okunamadı. Daha net, düz bir fotoğraf dene.");
        return;
      }
      const read = settings.merge ? mergeConsecutive(out.lessons, settings.plan) : sortLessons(out.lessons);
      const apply = () => setLessons(read);
      if (lessons.length) {
        Alert.alert("Mevcut liste", `${read.length} ders okundu. Mevcut listeyle ne yapılsın?`, [
          { text: "Değiştir", onPress: apply },
          { text: "Ekle", onPress: () => setLessons(prev => sortLessons([...prev, ...read])) },
          { text: "Vazgeç", style: "cancel" },
        ]);
      } else apply();
    } catch (e: any) {
      Alert.alert("Okuma hatası", e?.message ?? String(e));
    } finally {
      setReading(false);
    }
  }

  async function loadCalendars() {
    if (!(await ensurePermission())) {
      Alert.alert("Takvim izni gerekli", "Dersleri takvime eklemek için Ayarlar'dan takvim izni ver.", [
        { text: "Ayarları aç", onPress: () => Linking.openSettings() },
        { text: "Tamam", style: "cancel" },
      ]);
      return null;
    }
    const list = await listWritableCalendars();
    setCalendars(list);
    if (!list.length) {
      Alert.alert("Takvim yok", "Telefonda yazılabilir bir takvim bulunamadı. Takvim uygulamasında bir hesap ekleyip tekrar dene.");
      return null;
    }
    if (!settings.calendarId || !list.some(c => c.id === settings.calendarId)) {
      setSettings(s => ({ ...s, calendarId: list[0].id }));
      return list[0].id;
    }
    return settings.calendarId;
  }

  async function addToCalendar() {
    if (!finalLessons.length) return;
    if (problems.length) {
      Alert.alert("Eksik bilgi", `${problems.length} derste hata var (kırmızı işaretli). Düzeltip tekrar dene.`);
      return;
    }
    if (!termStart) {
      Alert.alert("Tarih geçersiz", "Başlangıç tarihini GG.AA.YYYY biçiminde yaz.");
      return;
    }
    const calendarId = calendars ? settings.calendarId : await loadCalendars();
    if (!calendarId) return;
    const cal = (calendars ?? []).find(c => c.id === calendarId);
    const end = termEnd(termStart, settings.weeks);
    Alert.alert(
      "Takvime eklensin mi?",
      `${finalLessons.length} ders, ${formatDate(termStart)} – ${formatDate(end)} arasında her hafta tekrarlanacak` +
        (cal ? `\nTakvim: ${cal.title}` : "") +
        (settings.reminder ? `\nHatırlatma: ${settings.reminder} dk önce` : ""),
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Ekle",
          onPress: async () => {
            setAdding(true);
            try {
              const ids = await addLessons(finalLessons, {
                calendarId,
                termStart,
                weeks: settings.weeks,
                reminderMinutes: settings.reminder,
              });
              const all = [...addedIds, ...ids];
              setAddedIds(all);
              await store.saveAddedEvents(all);
              Alert.alert("Eklendi 🎉", `${ids.length} ders takvimine eklendi. Takvim uygulamasından kontrol edebilirsin.`);
            } catch (e: any) {
              Alert.alert("Eklenemedi", e?.message ?? String(e));
            } finally {
              setAdding(false);
            }
          },
        },
      ],
    );
  }

  function undoAdded() {
    Alert.alert("Eklenenleri sil", `Bu uygulamanın takvime eklediği ${addedIds.length} tekrarlayan etkinlik silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          if (!(await ensurePermission())) return;
          setAdding(true);
          const failed = await removeEvents(addedIds);
          setAddedIds(failed);
          await store.saveAddedEvents(failed);
          setAdding(false);
          Alert.alert("Silindi", failed.length ? `${failed.length} etkinlik silinemedi.` : "Eklenen dersler takvimden kaldırıldı.");
        },
      },
    ]);
  }

  function saveLesson(l: Lesson) {
    const fixed = { ...l, start: normalizeTime(l.start) ?? l.start, end: normalizeTime(l.end) ?? l.end };
    setLessons(prev => sortLessons(prev.some(p => p.id === l.id) ? prev.map(p => (p.id === l.id ? fixed : p)) : [...prev, fixed]));
    setEditing(null);
  }

  if (!ready) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  const byDay = DAY_NAMES.map((name, i) => ({ name, day: i + 1, items: finalLessons.filter(l => l.day === i + 1) })).filter(
    g => g.items.length,
  );
  const invalidDay = finalLessons.filter(l => !(l.day >= 1 && l.day <= 7));

  return (
    <>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Ders Programı</Text>
            <Text style={styles.sub}>Fotoğraftan telefon takvimine</Text>
          </View>
          <Pressable onPress={() => setShowSettings(s => !s)} style={styles.iconBtn} hitSlop={8}>
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </Pressable>
        </View>

        {showSettings && (
          <View style={styles.card}>
            <Text style={styles.h2}>Gemini API anahtarı (ücretsiz)</Text>
            <Text style={styles.p}>
              1. Google AI Studio'yu aç ve Google hesabınla giriş yap.{"\n"}2. “Create API key”e dokun, “AIza…” ile başlayan
              anahtarı kopyala (kredi kartı gerekmez).{"\n"}3. Aşağıya yapıştırıp kaydet.
            </Text>
            <Pressable onPress={() => Linking.openURL("https://aistudio.google.com/apikey")}>
              <Text style={styles.link}>aistudio.google.com/apikey ↗</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="AIza…"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!!apiKey && keyDraft === apiKey}
            />
            <View style={styles.row}>
              <Btn title="Kaydet" onPress={saveKey} />
              {!!apiKey && <Btn title="Kapat" kind="ghost" onPress={() => setShowSettings(false)} />}
            </View>
            <Text style={styles.small}>
              Anahtar yalnızca bu telefonda şifreli olarak saklanır ve sadece Google'a gönderilir. Not: Ücretsiz katmanda
              gönderilen fotoğraflar Google tarafından ürün geliştirmede kullanılabilir.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.h2}>1. Ders programının fotoğrafı</Text>
          <View style={styles.row}>
            <Btn title="📷  Fotoğraf çek" onPress={() => pick("camera")} disabled={reading} flex />
            <Btn title="🖼️  Galeriden seç" onPress={() => pick("library")} disabled={reading} flex kind="soft" />
          </View>
          {photo && <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />}
          {reading && (
            <View style={[styles.row, styles.center, { marginTop: 12 }]}>
              <ActivityIndicator color={C.primary} />
              <Text style={styles.p}>  Program okunuyor…</Text>
            </View>
          )}
          {!!notes && (
            <View style={styles.note}>
              <Text style={{ color: C.warn }}>ℹ️ {notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={[styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
            <Text style={styles.h2}>2. Dersleri kontrol et</Text>
            {!!lessons.length && (
              <Pressable
                onPress={() =>
                  Alert.alert("Listeyi temizle", "Tüm dersler listeden silinsin mi? (Takvim etkilenmez)", [
                    { text: "Vazgeç", style: "cancel" },
                    { text: "Temizle", style: "destructive", onPress: () => setLessons([]) },
                  ])
                }
              >
                <Text style={[styles.link, { color: C.danger }]}>Temizle</Text>
              </Pressable>
            )}
          </View>
          {!finalLessons.length && <Text style={styles.p}>Fotoğraf seçince okunan dersler burada listelenir. Elle de ekleyebilirsin.</Text>}

          {[...byDay, ...(invalidDay.length ? [{ name: "Gün seçilmedi", day: 0, items: invalidDay }] : [])].map(g => (
            <View key={g.day} style={{ marginTop: 10 }}>
              <Text style={styles.dayTitle}>{g.name}</Text>
              {g.items.map(l => {
                const problem = lessonProblem(l);
                return (
                  <Pressable key={l.id} onPress={() => setEditing(l)} style={[styles.lesson, problem && styles.lessonBad]}>
                    <Text style={styles.time}>
                      {l.start || "--:--"}
                      {"\n"}
                      {l.end || "--:--"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.course}>{l.course || "(adsız)"}</Text>
                      {!!(l.period || l.location || l.teacher) && (
                        <Text style={styles.small}>{[periodLabel(l), l.location, l.teacher].filter(Boolean).join(" · ")}</Text>
                      )}
                      {problem && <Text style={{ color: C.danger, fontSize: 12 }}>⚠️ {problem}</Text>}
                    </View>
                    <Text style={{ color: C.muted }}>›</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={[styles.row, { marginTop: 12 }]}>
            <Btn
              title="＋ Ders ekle"
              kind="soft"
              onPress={() => setEditing({ id: newId(), course: "", day: 1, start: "", end: "" })}
            />
          </View>
          <View style={[styles.row, { alignItems: "center", marginTop: 12 }]}>
            <Switch value={settings.merge} onValueChange={merge => {
                setSettings(s => ({ ...s, merge }));
                if (merge) setLessons(prev => mergeConsecutive(prev, settings.plan));
              }}
            />
            <Text style={[styles.p, { flex: 1 }]}>  Art arda gelen aynı dersleri tek etkinlik yap</Text>
          </View>
        </View>

        {maxPeriod > 0 && (
          <View style={styles.card}>
            <Text style={styles.h2}>Ders saatleri</Text>
            <View style={styles.note}>
              <Text style={{ color: C.warn }}>
                ⏰ Bu programda saat yazmıyor; dersler sırasına göre okundu. Okulunun ders saatlerini gir, takvimdeki saatler
                buna göre hesaplanır.
              </Text>
            </View>
            <View style={[styles.row, { marginTop: 4 }]}>
              <Field label="İlk ders" value={settings.plan.firstStart} onChange={v => setPlan({ firstStart: v })} time />
              <Field label="Ders (dk)" value={settings.plan.lesson} onChange={v => setPlan({ lesson: +v || 1 })} />
              <Field label="Teneffüs (dk)" value={settings.plan.brk} onChange={v => setPlan({ brk: +v || 0 })} />
            </View>
            <View style={styles.row}>
              <Field
                label="Öğle arası kaçıncı dersten sonra (0 = yok)"
                value={settings.plan.lunchAfter}
                onChange={v => setPlan({ lunchAfter: +v || 0 })}
              />
              <Field label="Öğle arası (dk)" value={settings.plan.lunch} onChange={v => setPlan({ lunch: +v || 0 })} />
            </View>
            <View style={styles.periodGrid}>
              {Array.from({ length: Math.max(maxPeriod, 1) }, (_, i) => {
                const t = periodTimes(settings.plan, i + 1);
                return (
                  <Text key={i} style={styles.periodItem}>
                    <Text style={{ fontWeight: "700" }}>{i + 1}.</Text> {t.start}–{t.end}
                  </Text>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.h2}>3. Takvime ekle</Text>

          <Text style={styles.label}>Başlangıç tarihi</Text>
          <View style={[styles.row, { alignItems: "center" }]}>
            <TextInput
              style={[styles.input, { flex: 1, marginTop: 0 }, !termStart && { borderColor: C.danger }]}
              value={startText}
              onChangeText={setStartText}
              placeholder="GG.AA.YYYY"
              keyboardType="numbers-and-punctuation"
            />
            <Chip label="Bugün" onPress={() => setStartText(formatDate(new Date()))} />
            <Chip label="Gelecek Pzt" onPress={() => setStartText(formatDate(nextMonday(new Date(Date.now() + 86400000))))} />
          </View>

          <Text style={styles.label}>Kaç hafta tekrarlansın?</Text>
          <View style={[styles.row, { alignItems: "center" }]}>
            <Btn title="−" kind="soft" onPress={() => setSettings(s => ({ ...s, weeks: Math.max(1, s.weeks - 1) }))} />
            <Text style={styles.weeks}>{settings.weeks} hafta</Text>
            <Btn title="＋" kind="soft" onPress={() => setSettings(s => ({ ...s, weeks: Math.min(52, s.weeks + 1) }))} />
          </View>
          {termStart && <Text style={styles.small}>Son ders haftası: {formatDate(termEnd(termStart, settings.weeks))}</Text>}

          <Text style={styles.label}>Hatırlatma</Text>
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            {REMINDERS.map(r => (
              <Chip
                key={r}
                label={r ? `${r} dk önce` : "Yok"}
                active={settings.reminder === r}
                onPress={() => setSettings(s => ({ ...s, reminder: r }))}
              />
            ))}
          </View>

          <Text style={styles.label}>Takvim</Text>
          {calendars ? (
            <View style={[styles.row, { flexWrap: "wrap" }]}>
              {calendars.map(c => (
                <Chip
                  key={c.id}
                  label={c.title + (c.account && c.account !== c.title ? ` (${c.account})` : "")}
                  dot={c.color}
                  active={settings.calendarId === c.id}
                  onPress={() => setSettings(s => ({ ...s, calendarId: c.id }))}
                />
              ))}
            </View>
          ) : (
            <Pressable onPress={loadCalendars}>
              <Text style={styles.link}>Takvimleri göster (izin ister)</Text>
            </Pressable>
          )}

          <View style={{ marginTop: 16 }}>
            <Btn
              title={adding ? "İşleniyor…" : `📅  ${finalLessons.length} dersi takvime ekle`}
              onPress={addToCalendar}
              disabled={adding || !finalLessons.length}
            />
          </View>
          {!!addedIds.length && (
            <Pressable onPress={undoAdded} disabled={adding} style={{ marginTop: 12, alignSelf: "center" }}>
              <Text style={[styles.link, { color: C.danger }]}>Bu uygulamanın eklediği {addedIds.length} etkinliği takvimden sil</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <LessonEditor lesson={editing} onClose={() => setEditing(null)} onSave={saveLesson} onDelete={id => {
        setLessons(prev => prev.filter(p => p.id !== id));
        setEditing(null);
      }} />
    </>
  );
}

function LessonEditor({
  lesson,
  onClose,
  onSave,
  onDelete,
}: {
  lesson: Lesson | null;
  onClose: () => void;
  onSave: (l: Lesson) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Lesson | null>(lesson);
  useEffect(() => setDraft(lesson), [lesson]);
  if (!draft) return null;
  const set = (patch: Partial<Lesson>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const problem = lessonProblem({ ...draft, start: normalizeTime(draft.start) ?? draft.start, end: normalizeTime(draft.end) ?? draft.end });

  return (
    <Modal visible={!!lesson} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.h2}>Ders</Text>
          {!!draft.period && (
            <Text style={styles.small}>
              {periodLabel(draft)} – saat, “Ders saatleri”nden hesaplanıyor. Saati değiştirirsen bu derse özel saat kullanılır.
            </Text>
          )}
          <TextInput style={styles.input} value={draft.course} onChangeText={course => set({ course })} placeholder="Ders adı" />
          <Text style={styles.label}>Gün</Text>
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            {DAY_SHORT.map((d, i) => (
              <Chip key={d} label={d} active={draft.day === i + 1} onPress={() => set({ day: i + 1 })} />
            ))}
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Başlangıç</Text>
              <TextInput
                style={styles.input}
                value={draft.start}
                onChangeText={start => set({ start })}
                placeholder="08:30"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Bitiş</Text>
              <TextInput
                style={styles.input}
                value={draft.end}
                onChangeText={end => set({ end })}
                placeholder="09:10"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <TextInput
            style={styles.input}
            value={draft.location ?? ""}
            onChangeText={location => set({ location })}
            placeholder="Derslik (isteğe bağlı)"
          />
          <TextInput
            style={styles.input}
            value={draft.teacher ?? ""}
            onChangeText={teacher => set({ teacher })}
            placeholder="Öğretmen (isteğe bağlı)"
          />
          {problem && <Text style={{ color: C.danger, marginTop: 8 }}>⚠️ {problem}</Text>}
          <View style={[styles.row, { marginTop: 16 }]}>
            <Btn
              title="Kaydet"
              onPress={() =>
                onSave(
                  draft.period && (draft.start !== lesson?.start || draft.end !== lesson?.end)
                    ? { ...draft, period: undefined, periodEnd: undefined }
                    : draft,
                )
              }
              disabled={!!problem}
              flex
            />
            <Btn title="Sil" kind="danger" onPress={() => onDelete(draft.id)} />
            <Btn title="Vazgeç" kind="ghost" onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Btn({
  title,
  onPress,
  disabled,
  kind = "primary",
  flex,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: "primary" | "soft" | "ghost" | "danger";
  flex?: boolean;
}) {
  const bg = { primary: C.primary, soft: C.primarySoft, ghost: "transparent", danger: "#FDECEC" }[kind];
  const fg = { primary: "#fff", soft: C.primary, ghost: C.muted, danger: C.danger }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }, flex && { flex: 1 }]}
    >
      <Text style={{ color: fg, fontWeight: "600", fontSize: 15, textAlign: "center" }}>{title}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChange, time }: { label: string; value: string | number; onChange: (v: string) => void; time?: boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.label, { marginBottom: 0 }]} numberOfLines={2}>
        {label}
      </Text>
      <TextInput
        style={[styles.input, time && !normalizeTime(text) && { borderColor: C.danger }]}
        value={text}
        keyboardType={time ? "numbers-and-punctuation" : "number-pad"}
        onChangeText={setText}
        onEndEditing={() => onChange(time ? normalizeTime(text) ?? String(value) : text)}
        onBlur={() => onChange(time ? normalizeTime(text) ?? String(value) : text)}
      />
    </View>
  );
}

function Chip({ label, onPress, active, dot }: { label: string; onPress: () => void; active?: boolean; dot?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: C.primary, borderColor: C.primary }]}>
      {!!dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      <Text style={{ color: active ? "#fff" : C.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, gap: 14 },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  h1: { fontSize: 26, fontWeight: "800", color: C.text },
  sub: { color: C.muted, marginTop: 2 },
  h2: { fontSize: 17, fontWeight: "700", color: C.text, marginBottom: 8 },
  p: { color: C.text, lineHeight: 20 },
  small: { color: C.muted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  link: { color: C.primary, fontWeight: "600", marginTop: 6 },
  label: { color: C.muted, fontSize: 13, marginTop: 12, marginBottom: 6, fontWeight: "600" },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: "row", gap: 8 },
  iconBtn: { padding: 6 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 15,
    color: C.text,
    backgroundColor: "#FAFBFD",
    marginTop: 8,
  },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, justifyContent: "center" },
  photo: { width: "100%", height: 220, marginTop: 12, borderRadius: 10, backgroundColor: "#EEF1F7" },
  note: { backgroundColor: C.warnSoft, borderRadius: 10, padding: 10, marginTop: 12 },
  dayTitle: { fontWeight: "700", color: C.primary, marginBottom: 4 },
  lesson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#F8F9FC",
    marginBottom: 6,
  },
  lessonBad: { backgroundColor: "#FDECEC" },
  time: { width: 48, fontVariant: ["tabular-nums"], color: C.muted, fontSize: 13, textAlign: "center" },
  course: { fontWeight: "600", color: C.text, fontSize: 15 },
  weeks: { fontSize: 16, fontWeight: "700", minWidth: 80, textAlign: "center", color: C.text },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 6,
    backgroundColor: "#fff",
  },
  periodGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 6 },
  periodItem: {
    backgroundColor: "#F8F9FC",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 13,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
});
