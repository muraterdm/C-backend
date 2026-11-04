# Nöbet Takvimi

Nöbet listesinin fotoğrafından seçilen kişinin (varsayılan: **Tuba**) nöbet günlerini bulup takvimde işaretleyen tek sayfalık web uygulaması.

## Kullanım

1. `index.html` dosyasını tarayıcıda aç (sunucu gerekmez, internet bağlantısı OCR kütüphanesi için gerekir).
2. **Fotoğraf** alanından nöbet listesinin fotoğrafını seç.
3. Uygulama metni okur (Tesseract.js, Türkçe + İngilizce), içinde "Tuba" geçen satırları bulur ve bu satırlardaki tarihleri takvimde işaretler.
4. Okuma hatalıysa "Okunan metin" kutusunda düzeltip **Metni yeniden tara**'ya bas; ya da takvimde bir güne tıklayarak işareti elle ekle/kaldır.
5. **Takvime aktar (.ics)** ile nöbetleri telefon/Google/Outlook takvimine ekleyebilirsin.

## Tanınan tarih biçimleri

- `05.11.2026`, `5/11/26`, `05-11` (yıl yoksa "Varsayılan yıl" kullanılır)
- `12 Kasım`, `12 Kasım 2026`
- Sadece gün numaraları: `Tuba 3 7 12 18` veya `5 Perşembe Tuba` → "Varsayılan ay/yıl"ın günleri
- Satır başında gün + `|` ile ayrılmış ameliyathane sütunu: `4 Hatice - Nahide | Tuba` → nöbet ve ameliyathane ayrı renkte işaretlenir

İsim eşleşmesi büyük/küçük harf duyarsızdır (`TUBA`, `Tuba`); `Tuğba` gibi farklı isimler eşleşmez.
El yazısı listeler OCR ile güvenilir okunamaz; Kasım 2026 listesi elle dökülüp uygulamaya gömülüdür ("Kasım 2026 listesini yükle").
Veriler yalnızca tarayıcının yerel deposunda saklanır.
