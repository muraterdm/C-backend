// Fotoğraftaki ders programını Google Gemini (ücretsiz katman) ile okur.
import { Lesson, newId, normalizeTime } from "./schedule";

// Sırayla denenir: bir model kaldırılmışsa / kota dolmuşsa sonrakine geçilir.
const MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

const PROMPT = `Bu fotoğraf bir haftalık ders programı (okul / üniversite / kurs).
Programdaki HER ders saatini çıkar.

Kurallar:
- day: haftanın günü, 1=Pazartesi, 2=Salı, 3=Çarşamba, 4=Perşembe, 5=Cuma, 6=Cumartesi, 7=Pazar.
  Gün adları kısaltılmış (Pzt, Sa, Çrş, Prş, Cu, Cmt, Pz) veya İngilizce (Mon, Tue…) olabilir.
- start / end: 24 saat biçiminde "HH:MM". Saatler satır/sütun başlığında yazıyorsa onları kullan.
  Sadece "1. ders, 2. ders" gibi ders numaraları varsa ve programda saat çizelgesi yoksa
  makul bir okul düzeni varsay (1. ders 08:30, 40 dk ders, 10 dk teneffüs) ve notes alanında bunu belirt.
- course: dersin adı, fotoğrafta yazdığı gibi (kod varsa adla birlikte, ör. "MAT101 Matematik").
- location: derslik / sınıf / bina (yoksa boş bırak). teacher: öğretmen / öğretim üyesi (yoksa boş).
- Boş hücreleri, "öğle arası", "teneffüs", "boş" gibi ders olmayan hücreleri ATLA.
- Bir ders birden fazla saate yayılıyorsa (birleştirilmiş hücre) tek kayıt olarak, ilk saatin başlangıcı ve son saatin bitişiyle yaz.
- Okuyamadığın veya emin olmadığın şeyleri notes alanına kısaca yaz.
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
          location: { type: "STRING" },
          teacher: { type: "STRING" },
        },
        required: ["course", "day", "start", "end"],
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
        }))
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
