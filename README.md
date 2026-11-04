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
2. Fotoğraf Claude'a gönderilir; el yazısı liste okunur, ay/yıl başlıktan alınır ve günler takvimde işaretlenir.
3. "Okunan metin" kutusunda sonucu kontrol et; hata varsa düzeltip **Metni yeniden tara**'ya bas.
4. Her ayın listesi bir kez kaydedilir ve herkes için ortaktır: isim değiştirince aynı listelerden o kişinin günleri anında gösterilir.
   Ay okları ile geçmiş aylara bakabilirsin.
5. **Takvime aktar (.ics)** ile telefon takvimine ekleyebilirsin.

## İlk kurulum (her telefonda bir kez)

El yazısını okumak için bir Claude API anahtarı gerekir:

1. https://console.anthropic.com adresinde hesap aç, kredi yükle, **API Keys** bölümünden anahtar oluştur.
2. Uygulamada **El yazısı okuma ayarı** bölümüne anahtarı yapıştırıp **Kaydet**'e bas.

Anahtar yalnızca o tarayıcıda (localStorage) saklanır ve sadece `api.anthropic.com`'a gönderilir; depoya veya başka bir yere yazılmaz.
Anahtar girilmezse tarayıcıda çalışan Tesseract OCR kullanılır; bu yöntem basılı listelerde çalışır ama el yazısında güvenilir değildir.

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

API anahtarı yokken fotoğraf yüklenirse uygulama anahtar ister; "Yine de basit okumayla dene" seçilirse sonuç sadece taslak olarak gösterilir,
"Kaydet ve tara"ya basılmadıkça kayıtlı listenin üzerine yazılmaz.
