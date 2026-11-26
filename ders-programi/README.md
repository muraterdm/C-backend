# Ders Programı 📅

Ders programının **fotoğrafını** çek ya da galeriden seç → uygulama **ücretsiz Google Gemini** ile günleri, saatleri ve
dersleri okur → kontrol edip düzelttikten sonra tek dokunuşla **telefonun kendi takvimine** (iPhone Takvim / Google Takvim)
haftalık tekrarlayan etkinlik olarak ekler. Android ve iOS için tek kod (Expo / React Native).

## Özellikler

- 📷 Kamera ya da galeriden fotoğraf; el yazısı ve tablo programları okunur
- ✏️ Okunan dersleri gün gün listeleme, düzenleme, silme, elle ders ekleme
- 🔗 Art arda gelen aynı ders saatlerini (ör. 2 saatlik Matematik) tek etkinlikte birleştirme
- 🔁 Seçilen başlangıç tarihinden itibaren N hafta her hafta tekrar
- ⏰ Hatırlatma (5–60 dk önce), takvim seçimi (iCloud, Gmail hesabı vb.)
- ↩️ Uygulamanın eklediği etkinlikleri tek dokunuşla takvimden geri silme
- 🔐 API anahtarı telefonda şifreli (SecureStore) saklanır, sadece Google'a gönderilir

## 1. Ücretsiz Gemini API anahtarı

1. https://aistudio.google.com/apikey adresini aç, Google hesabınla giriş yap.
2. **Create API key** → `AIza…` ile başlayan anahtarı kopyala (kredi kartı gerekmez).
3. Uygulamayı ilk açtığında çıkan alana yapıştır → **Kaydet**. (Sonradan ⚙️ simgesinden değiştirilebilir.)

> Not: Ücretsiz katmanda gönderilen içerik Google tarafından ürün geliştirmede kullanılabilir.

## 2. Telefonda çalıştırma

### En hızlısı – Expo Go (Android + iPhone, ücretsiz, hesap gerekmez)

```bash
cd ders-programi
npm install
npx expo start
```

Telefona **Expo Go** uygulamasını kur (App Store / Play Store) ve terminaldeki QR kodu okut
(iPhone'da Kamera uygulamasıyla, Android'de Expo Go içinden). Bilgisayar ve telefon aynı Wi‑Fi'de olmalı;
olmuyorsa `npx expo start --tunnel`.

### Android APK (kalıcı kurulum, ücretsiz)

- **GitHub ile:** depoda **Actions → “Ders Programı – Android APK” → Run workflow**. Bitince sayfanın altındaki
  **Artifacts**'tan `ders-programi-apk`'yı indir, zip'ten çıkan `.apk`'yı telefona at ve aç
  (“Bilinmeyen kaynaklardan yükleme”ye izin ver). `ders-programi/` klasöründe her değişiklikte de otomatik derlenir.
- **EAS ile (ücretsiz Expo hesabı):** `npx eas-cli build -p android --profile preview` (ilk seferde `npx eas-cli build:configure`).
- **Kendi bilgisayarında (Android Studio kurulu):** `npx expo run:android --variant release`.

### iPhone'a kalıcı kurulum

Apple, App Store dışından kurulum için geliştirici imzası ister:
- Ücretsiz: Mac + Xcode ile `npx expo run:ios --device` (ücretsiz Apple ID ile imzalanır, 7 gün geçerli).
- Kalıcı / TestFlight / App Store: Apple Developer Program (yıllık ücretli) + `npx eas-cli build -p ios`.
- Ücretsiz ve kolay yol: **Expo Go** ile kullanmak (yukarıda).

## Kullanım

1. **Fotoğraf çek / Galeriden seç** → birkaç saniyede dersler listelenir.
2. Listeyi kontrol et: bir derse dokunup gün, saat, derslik, öğretmeni düzelt; kırmızı satırlar eksik bilgidir.
3. **Başlangıç tarihi**, **hafta sayısı**, **hatırlatma** ve **takvim**i seç.
4. **Takvime ekle** → onayla. Dersler takvimde her hafta tekrarlanır.
5. Yanlış eklediysen **“Bu uygulamanın eklediği … etkinliği takvimden sil”** ile hepsini geri al.

İpucu: Programı düz, iyi ışıkta ve tüm tabloyu kapsayacak şekilde çek (ekran görüntüsü / PDF görüntüsü de olur).

**Saat yazmayan programlar** (ör. e-Okul / MEBBİS “Haftalık Ders Çizelgesi”, sadece satır satır dersler): dersler sırasına
göre (1., 2., … ders) okunur ve ekranda **Ders saatleri** bölümü çıkar. Okulunun düzenini gir: ilk ders başlangıcı, ders
ve teneffüs süresi, öğle arasının kaçıncı dersten sonra olduğu ve süresi. Varsayılan: 08:30, 40 dk ders, 10 dk teneffüs,
4. dersten sonra 40 dk öğle arası. Saatler hemen yeniden hesaplanır; arka arkaya gelen aynı dersler (ör. 1.–2. ders)
tek etkinlik olur, öğle arasının iki yanı birleştirilmez. Bir derse dokunup saatini elle değiştirirsen o derse özel saat kullanılır.
Etkinlik adına sınıf/şube eklenir (ör. “Birinci Yabancı Dil (İngilizce) – 12/B”), yeri derslik olur.

## Geliştirme

```bash
npx tsc --noEmit   # tip kontrolü
npx expo lint      # lint
```

- `App.tsx` – ekran
- `src/gemini.ts` – fotoğraf → ders listesi (Gemini, JSON şemalı yanıt; model kaldırılırsa sıradakini dener)
- `src/calendar.ts` – takvim izni, takvim listesi, haftalık tekrarlayan etkinlik ekleme/silme (`expo-calendar/legacy`, Expo Go uyumlu)
- `src/schedule.ts` – saat/tarih ayrıştırma, ilk ders günü hesabı, ardışık dersleri birleştirme
- `src/storage.ts` – anahtar (SecureStore), ders listesi ve ayarlar (AsyncStorage)
