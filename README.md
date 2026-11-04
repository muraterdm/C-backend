# Nöbet Takvimi

Aylık nöbet listesinin fotoğrafından, **İsim** alanına yazılan ya da listeden seçilen kişinin nöbet ve ameliyathane günlerini bulup takvimde işaretleyen web uygulaması.

Canlı adres (GitHub Pages açıldıysa): https://muraterdm.github.io/C-backend/

## Telefona yükleme

Uygulama bir PWA'dır: telefona yüklenince ana ekranda simgesiyle açılır, tam ekran çalışır, internet yokken de takvimi gösterir
(fotoğraf okuma için internet gerekir).

- **Android (Chrome):** sayfayı aç → üstte çıkan **Yükle** düğmesine dokun (ya da ⋮ menü → **Uygulamayı yükle**).
- **iPhone (Safari):** sayfayı aç → **Paylaş** → **Ana Ekrana Ekle**.

## Her ay kullanım

1. Sayfayı aç, **İsim** alanına ismini yaz ya da altta çıkan isim düğmelerinden birine dokun (bir kez seçmen yeterli, hatırlanır).
   Fotoğraf alanından o ayın listesinin fotoğrafını seç.
2. Fotoğraf Gemini'ye (ya da Claude'a) gönderilir; el yazısı liste okunur, ay/yıl başlıktan alınır ve günler takvimde işaretlenir.
3. "Okunan metin" kutusunda sonucu kontrol et; hata varsa düzeltip **Metni yeniden tara**'ya bas.
4. Her ayın listesi bir kez kaydedilir ve herkes için ortaktır: isim değiştirince aynı listelerden o kişinin günleri anında gösterilir.
   Ay okları ile geçmiş aylara bakabilirsin.
5. **Takvime aktar (.ics)** ile telefon takvimine ekleyebilirsin.

## İlk kurulum (her telefonda bir kez): ücretsiz API anahtarı

El yazısını okumak için bir yapay zekâ API anahtarı gerekir. Ücretsiz seçenek Google Gemini:

1. https://aistudio.google.com/apikey adresini aç, Google hesabınla giriş yap.
2. **Create API key** de, çıkan `AIza…` ile başlayan anahtarı kopyala (kredi kartı gerekmez).
3. Uygulamada **El yazısı okuma ayarı** bölümüne yapıştırıp **Kaydet**'e bas.

İstenirse ücretli Claude anahtarı (`sk-ant-…`, https://console.anthropic.com) da girilebilir; uygulama anahtarın türünü kendisi tanır.
Anahtar yalnızca o tarayıcıda (localStorage) saklanır ve sadece ilgili servise gönderilir; depoya yazılmaz.
Not: Google'ın ücretsiz katmanında gönderilen içerik Google tarafından ürün geliştirmede kullanılabilir (fotoğraftaki isimler dahil).

Anahtar girilmezse uygulama anahtar ister; "Yine de basit okumayla dene" (Tesseract) seçilirse sonuç sadece taslaktır.

## Metin biçimi

```
ARALIK 2026
1 Tuba - Ceren | -
2 Rojda - Selma | Tuba
```

`gün İsim - İsim | Ameliyathane` — `|` sonrası ameliyathane sütunudur, `-` boş demektir.
Başka biçimler de tanınır: `05.11.2026`, `12 Kasım`, `Tuba 3 7 12` (varsayılan ayın günleri).

İsim eşleşmesi büyük/küçük harf ve Türkçe karakter farkına duyarsızdır (`TUBA`, `tuba`, `Gulcan` = `Gülcan`) ve tam kelime arar
(`Tuba` → `Tuba Kaya` eşleşir, `Tubanur` eşleşmez). El yazısı okuma hatalarına karşı 4+ harfli isimlerde tek harf farkı kabul edilir
(`Tubo`, `Tuha` → `Tuba`); ancak listede ayrı bir kişi olarak düzenli geçen isimler (ör. hem `Tuba` hem `Tuğba` varsa) karıştırılmaz.
Takvimde bir güne dokunarak yapılan elle düzeltmeler sadece o isim için saklanır.

Fotoğraf okunurken yapay zekâya ekipteki bilinen isimler verilir ve okunan her isim ekipteki en yakın isme bağlanır
(ör. `Pubo`, `Rubo`, `Tubo` → `Tuba`). Ekip listesi yeni listelerde geçen isimlerle kendiliğinden genişler.
Kağıtta kişi başı özet tablosu varsa (`Tubo: 9`) metne `# Özet: Tuba 9, …` satırı olarak eklenir; takvimde bulunan
nöbet sayısı bununla tutmazsa uygulama uyarır.

