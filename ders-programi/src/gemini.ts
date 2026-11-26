// Fotoğraftaki ders programını Google Gemini (ücretsiz katman) ile okur.
import { Lesson, newId, normalizeTime } from "./schedule";

// Sırayla denenir: bir model kaldırılmışsa / kota dolmuşsa sonrakine geçilir.
const MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

const PROMPT = `Bu fotoğraf bir haftalık ders programı (okul / üniversite / kurs; öğrenci ya da öğretmen programı olabilir).
Programdaki HER dolu ders hücresini ayrı bir kayıt olarak çıkar.

Kurallar:
- day: haftanın günü, 1=Pazartesi, 2=Salı, 3=Çarşamba, 4=Perşembe, 5=Cuma, 6=Cumartesi, 7=Pazar.
  Gün adları kısaltılmış (Pzt, Sa, Çrş, Prş, Cu, Cmt, Pz) veya İngilizce (Mon, Tue…) olabilir.
- SAATLER: Programda saatler yazıyorsa start / end alanlarına 24 saat biçiminde "HH:MM" olarak yaz, period'u boş bırak.
  Programda saat YOKSA (sadece satırlar ya da "1. ders, 2. ders" gibi numaralar varsa) ASLA saat uydurma:
  start / end boş kalsın, period alanına hücrenin kaçıncı ders satırında olduğunu yaz (en üstteki ders satırı = 1).
  Satır numarasını sayarken boş satırları da say: ör. Perşembe sütununda ilk dolu hücre 5. satırdaysa period = 5.
- course: dersin adı, düzgün yazımla (TAMAMEN BÜYÜK HARF yazılmışsa Türkçe kurallarıyla sadece baş harfleri büyük yap,
  ör. "BİRİNCİ YABANCI DİL (İNGİLİZCE)" → "Birinci Yabancı Dil (İngilizce)").
  Hücrede sınıf / şube bilgisi varsa kısaca sona ekle: "AL - 11. Sınıf / F Şubesi" → "Seçmeli Yabancı Dil – 11/F".
- location: derslik ve varsa bina, kısa haliyle (ör. "K216 Derslik · Harput Anadolu Lisesi Binası"); yoksa boş.
- teacher: hücrede öğretmen adı yazıyorsa onu yaz; yoksa boş (başlıktaki programın sahibini her derse yazma).
- Boş hücreleri, "öğle arası", "teneffüs", "boş" gibi ders olmayan hücreleri ATLA.
- Birleştirilmiş (birden fazla satıra yayılan) hücre: saatliyse tek kayıt (ilk başlangıç–son bitiş);
  numaralıysa kapladığı her satır için ayrı kayıt yaz.
- Okuyamadığın veya emin olmadığın şeyleri notes alanına kısaca Türkçe yaz; her şey netse notes boş kalsın.
- Fotoğraf ders programı değilse lessons boş liste olsun ve notes'ta nedenini söyle.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    lessons: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          course: { type: "STRING" },
          day: { type: "INTEGER" },
          start: { type: "STRING" },
          end: { type: "STRING" },
          period: { type: "INTEGER" },
          location: { type: "STRING" },
          teacher: { type: "STRING" },
        },
        required: ["course", "day"],
      },
    },
    notes: { type: "STRING" },
  },
  required: ["lessons"],
};

export type ParseResult = { lessons: Lesson[]; notes?: string; model: string };

export class GeminiError extends Error {}

async function callModel(model: string, apiKey: string, base64: string, mimeType: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export async function readSchedule(apiKey: string, base64: string, mimeType = "image/jpeg"): Promise<ParseResult> {
  let lastError = "";
  for (const model of MODELS) {
    let status: number, body: any;
    try {
      ({ status, body } = await callModel(model, apiKey, base64, mimeType));
    } catch {
      throw new GeminiError("İnternet bağlantısı kurulamadı. Bağlantını kontrol edip tekrar dene.");
    }

    if (status === 200) {
      const text: string =
        body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
      if (!text) {
        lastError = body?.promptFeedback?.blockReason
          ? `Gemini fotoğrafı işlemeyi reddetti (${body.promptFeedback.blockReason}).`
          : "Gemini boş yanıt döndürdü.";
        continue;
      }
      let parsed: any;
      try {
        parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      } catch {
        lastError = "Gemini yanıtı okunamadı.";
        continue;
      }
      const lessons: Lesson[] = (Array.isArray(parsed?.lessons) ? parsed.lessons : [])
        .map((l: any) => ({
          id: newId(),
          course: String(l.course ?? "").trim(),
          day: Number(l.day),
          start: normalizeTime(l.start) ?? String(l.start ?? ""),
          end: normalizeTime(l.end) ?? String(l.end ?? ""),
          location: l.location ? String(l.location).trim() : undefined,
          teacher: l.teacher ? String(l.teacher).trim() : undefined,
          period: Number.isInteger(l.period) && l.period > 0 && l.period < 20 ? l.period : undefined,
        }))
        // Saat de okunduysa saat önceliklidir; ders numarası sadece saat yoksa kullanılır.
        .map((l: Lesson) => (l.period && normalizeTime(l.start) && normalizeTime(l.end) ? { ...l, period: undefined } : l))
        .filter((l: Lesson) => l.course);
      return { lessons, notes: parsed?.notes || undefined, model };
    }

    const msg: string = body?.error?.message ?? `HTTP ${status}`;
    if (status === 400 && /api key|API_KEY/i.test(msg)) {
      throw new GeminiError("API anahtarı geçersiz. Ayarlar'dan anahtarı kontrol et.");
    }
    if (status === 403) {
      throw new GeminiError(`API anahtarı reddedildi: ${msg}`);
    }
    // 404: model yok, 429: kota, 5xx: yoğunluk → sonraki modeli dene
    lastError = status === 429 ? "Ücretsiz kota doldu, biraz bekleyip tekrar dene." : msg;
  }
  throw new GeminiError(lastError || "Fotoğraf okunamadı.");
}
