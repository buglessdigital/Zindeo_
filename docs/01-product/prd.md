# Zindeo — Product Requirements Document (PRD)

| | |
|---|---|
| **Durum** | Taslak v0.1 — MVP kapsamı geliştirme sırasında netleşecek |
| **Sahibi** | Taner Yıldırım |
| **Son güncelleme** | 23 Ekim 2026 |
| **İlgili** | [Product Vision](vision.md) |

---

## 1. Amaç

Bu doküman Zindeo'nun **ne yapacağını** tanımlar: özellikler, kullanıcı hikâyeleri, kabul kriterleri ve fonksiyonel olmayan gereksinimler. **Nasıl yapılacağı** (mimari, veri modeli, API) ayrı dokümanlarda yer alır.

## 2. Önceliklendirme

Her gereksinim MoSCoW yöntemiyle işaretlenir:

| Etiket | Anlamı |
|---|---|
| **M** — Must | MVP'de olmak zorunda; yoksa yayınlanmaz |
| **S** — Should | MVP'de olması çok iyi olur; zaman yetmezse ilk güncellemeye kalır |
| **C** — Could | MVP sonrası |
| **W** — Won't (şimdilik) | Bilerek kapsam dışı |

> MVP kapsamı kesin değildir. Etiketler geliştirme ilerledikçe güncellenecektir. Her değişiklik dokümanın sonundaki *Değişiklik geçmişi* bölümüne yazılır.

Gereksinim ID formatı: `<EPIC>-<numara>` (ör. `LOG-03`). Bu ID'ler backlog, kod ve testlerde referans olarak kullanılacaktır.

## 3. Epic'ler

| Epic | Kod | MVP |
|---|---|---|
| Hesap ve kimlik doğrulama | `AUTH` | M |
| Onboarding ve hedef belirleme | `ONB` | M |
| Besin veritabanı ve arama | `FOOD` | M |
| Öğün kaydı (manuel) | `LOG` | M |
| Kamera ile tanıma | `SCAN` | M |
| Barkod ile kayıt | `BAR` | S |
| Günlük panel ve ilerleme | `DASH` | M |
| Kilo takibi | `WGT` | M |
| Abonelik ve ödeme | `SUB` | M |
| Bildirimler | `NOTIF` | S |
| Gizlilik, izinler ve veri yönetimi | `PRIV` | M |
| Ayarlar ve profil | `SET` | M |
| Buzdolabından tarif önerisi | `FRIDGE` | C |
| Sağlıklı restoran haritası | `MAP` | C |

---

## 4. Gereksinimler

### 4.1 `AUTH` — Hesap ve kimlik doğrulama

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| AUTH-01 | Kullanıcı olarak **Apple ile giriş** yapabilmek istiyorum ki şifre oluşturmak zorunda kalmayayım. | M |
| AUTH-02 | Kullanıcı olarak **Google ile giriş** yapabilmek istiyorum. | M |
| AUTH-03 | Kullanıcı olarak **e-posta ile** kayıt olup giriş yapabilmek istiyorum (doğrulama e-postası ve şifre sıfırlama dahil). | M |
| AUTH-04 | Kullanıcı olarak telefonu değiştirdiğimde aynı hesapla girip tüm verime ulaşmak istiyorum. | M |
| AUTH-05 | Kullanıcı olarak hesabımı ve tüm verimi uygulama içinden kalıcı olarak silebilmek istiyorum. | M |

**Kabul kriterleri**
- AUTH-01: iOS'ta başka bir sosyal giriş seçeneği sunulduğu için Apple ile giriş zorunludur (App Store Review Guideline 4.8).
- AUTH-05: Hesap silme, App Store ve Google Play kurallarına uygun olarak uygulama içinden yapılabilmelidir. Silme işlemi sunucudaki kişisel veriyi, fotoğrafları ve analitik kimliği kapsar.

### 4.2 `ONB` — Onboarding ve hedef belirleme

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| ONB-01 | Kullanıcı olarak cinsiyet, doğum tarihi, boy, mevcut kilo ve aktivite seviyemi girmek istiyorum. | M |
| ONB-02 | Kullanıcı olarak hedefimi seçmek istiyorum: kilo vermek, korumak veya almak. | M |
| ONB-03 | Kullanıcı olarak hedef kilomu ve haftalık hedef hızımı (ör. haftada 0,5 kg) seçmek istiyorum. | M |
| ONB-04 | Kullanıcı olarak girdiğim bilgilere göre **günlük kalori ve makro hedeflerimi** (protein, karbonhidrat, yağ) görmek istiyorum. | M |
| ONB-05 | Kullanıcı olarak tahmini hedefe ulaşma tarihimi görmek istiyorum. | M |
| ONB-06 | Kullanıcı olarak hesaplanan hedefleri elle değiştirebilmek istiyorum. | S |
| ONB-07 | Kullanıcı olarak onboarding sırasında kamera ile taramanın nasıl çalıştığını kısaca görmek istiyorum. | S |

**Kabul kriterleri ve iş kuralları**
- Hesaplama yöntemi (BMR için Mifflin-St Jeor, aktivite katsayısı ile TDEE, hedefe göre kalori açığı/fazlası, makro dağılımı) [`04-data/nutrition-calculation.md`](../04-data/nutrition-calculation.md) dokümanında tanımlanacaktır.
- **Güvenlik sınırları:**
  - Günlük kalori hedefi belirli bir alt sınırın altına inemez (taslak: kadınlar için 1.200 kcal, erkekler için 1.500 kcal; nihai değerler hesaplama dokümanında belirlenecek).
  - Haftalık kilo verme hızı vücut ağırlığının %1'ini aşamaz.
  - Hedef kilo, sağlıklı vücut kitle indeksi (VKİ) aralığının altında olamaz.
- 18 yaş altı kullanıcılar kilo verme hedefi seçemez (yaş sınırı hukuki inceleme sonrası netleşecek).
- Hamilelik ve emzirme durumunda kullanıcıya bir uyarı gösterilir ve kilo verme hedefi önerilmez.

### 4.3 `FOOD` — Besin veritabanı ve arama

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| FOOD-01 | Kullanıcı olarak yediğim yemeği **Türkçe adıyla** arayıp bulmak istiyorum. | M |
| FOOD-02 | Kullanıcı olarak yazım hatası yapsam veya Türkçe karakter kullanmasam da sonuç bulmak istiyorum ("kuru fasulye" ↔ "kurufasulye", "ıspanak" ↔ "ispanak"). | M |
| FOOD-03 | Kullanıcı olarak her yemeğin kalori, protein, karbonhidrat ve yağ değerlerini görmek istiyorum. | M |
| FOOD-04 | Kullanıcı olarak yemeğe **anlamlı porsiyon birimleriyle** (kase, tabak, dilim, adet, yemek kaşığı, gram) miktar girmek istiyorum. | M |
| FOOD-05 | Kullanıcı olarak son yediklerimi ve sık yediklerimi aramada önce görmek istiyorum. | M |
| FOOD-06 | Kullanıcı olarak veritabanında olmayan bir yemeği kendim oluşturup kaydedebilmek istiyorum. | S |
| FOOD-07 | Kullanıcı olarak lif, şeker, sodyum gibi ek besin değerlerini görmek istiyorum. | S |
| FOOD-08 | Kullanıcı olarak kendi tariflerimi (malzemeler + miktarlar) oluşturup porsiyon olarak kaydetmek istiyorum. | C |

**İş kuralları**
- Besin değerleri tek bir kaynaktan, **Zindeo besin veritabanından** gelir. Arama, kamera ve barkod aynı veritabanını kullanır.
- Veri kaynakları: TürKomp (Türk gıdaları; lisans izni netleştirilecek), USDA FoodData Central (genel), Open Food Facts (paketli ürünler), Zindeo standart tarifleri (ev yemekleri).
- Ev yemeklerinin değerleri standart tarif üzerinden hesaplanır: yemek → standart tarif → malzemeler → besin değerleri.
- Yemek listesi ve ID yapısı [`04-data/food-taxonomy.md`](../04-data/food-taxonomy.md) dokümanında tanımlanacaktır.

### 4.4 `LOG` — Öğün kaydı

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| LOG-01 | Kullanıcı olarak yediğimi bir öğüne (kahvaltı, öğle, akşam, ara öğün) eklemek istiyorum. | M |
| LOG-02 | Kullanıcı olarak kaydı sonradan düzenlemek, silmek veya başka bir öğüne taşımak istiyorum. | M |
| LOG-03 | Kullanıcı olarak geçmiş günlere kayıt ekleyebilmek istiyorum. | M |
| LOG-04 | Kullanıcı olarak dünkü bir öğünü tek dokunuşla bugüne kopyalamak istiyorum. | S |
| LOG-05 | Kullanıcı olarak su tüketimimi kaydetmek istiyorum. | S |
| LOG-06 | Kullanıcı olarak internet yokken de kayıt ekleyebilmek, kayıtlarımın bağlantı gelince senkronize olmasını istiyorum. | S |

**Kabul kriterleri**
- Arama ile bir kaydı eklemek ana ekrandan en fazla 4 dokunuşta tamamlanabilmelidir.
- Öğün saatine göre varsayılan öğün otomatik seçilir (ör. 07:00–11:00 → kahvaltı).

### 4.5 `SCAN` — Kamera ile tanıma

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| SCAN-01 | Kullanıcı olarak tabağımın fotoğrafını çekip yemeğin ne olduğunu otomatik görmek istiyorum. | M |
| SCAN-02 | Kullanıcı olarak tabakta birden fazla yemek varsa (ör. pilav + kuru fasulye + cacık) her birinin ayrı tanınmasını istiyorum. | M |
| SCAN-03 | Kullanıcı olarak her yemek için tahmini gramajı ve buna göre kaloriyi görmek istiyorum. | M |
| SCAN-04 | Kullanıcı olarak tanınan yemeği listeden başka bir yemekle değiştirebilmek istiyorum. | M |
| SCAN-05 | Kullanıcı olarak gramajı kaydırıcı veya porsiyon birimiyle hızlıca düzeltebilmek istiyorum. | M |
| SCAN-06 | Kullanıcı olarak sistem emin olmadığında bana 2–3 seçenek sunulmasını istiyorum. | M |
| SCAN-07 | Kullanıcı olarak galeriden fotoğraf seçerek de tarama yapabilmek istiyorum. | S |
| SCAN-08 | Kullanıcı olarak taramanın internetsiz de çalışmasını istiyorum. | C (Aşama 2) |

**Kabul kriterleri ve iş kuralları**
- Akış: fotoğraf → tanıma sonucu ekranı (yemekler, gramajlar, toplam kalori) → kullanıcı onaylar veya düzeltir → kayıt.
- Yapay zekâ çıktısı **yalnızca** Zindeo yemek listesindeki ID'ler, güven skorları ve tahmini gramajdır. Kalori ve besin değerleri her zaman Zindeo veritabanından hesaplanır (FOOD iş kuralları).
- Güven skoru eşiğin altındaysa tek bir tahmin yerine seçenekler gösterilir (SCAN-06).
- Tanıma servisi uygulamada bir arayüzün (`FoodRecognizer`) arkasındadır; Aşama 1'de bulut LLM, Aşama 2'de cihaz üzerindeki model kullanılır (bkz. mimari dokümanı).
- Tarama sonucu ekranı, fotoğraf çekildikten sonra hedef olarak 3 saniye içinde gelmelidir (Aşama 1; nihai hedef NFR bölümünde).
- Kullanıcının düzelttiği sonuçlar, **izin vermişse**, fotoğrafla birlikte eğitim verisi olarak saklanır (bkz. `PRIV`).
- Ücretsiz kullanıcılar için günlük tarama limiti uygulanır (bkz. `SUB`).

### 4.6 `BAR` — Barkod ile kayıt

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| BAR-01 | Kullanıcı olarak paketli ürünün barkodunu okutup besin değerlerini görmek istiyorum. | S |
| BAR-02 | Kullanıcı olarak barkodu bulunamayan bir ürünü besin tablosunun fotoğrafını çekerek eklemek istiyorum. | C |

### 4.7 `DASH` — Günlük panel ve ilerleme

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| DASH-01 | Kullanıcı olarak bugün aldığım ve kalan kaloriyi tek bakışta görmek istiyorum. | M |
| DASH-02 | Kullanıcı olarak protein, karbonhidrat ve yağ hedeflerime ne kadar yaklaştığımı görmek istiyorum. | M |
| DASH-03 | Kullanıcı olarak öğün öğün ne yediğimi görmek istiyorum. | M |
| DASH-04 | Kullanıcı olarak haftalık kalori ortalamamı ve hedefe uyumumu görmek istiyorum. | M |
| DASH-05 | Kullanıcı olarak art arda kayıt yaptığım günleri (seri) görmek istiyorum. | S |
| DASH-06 | Kullanıcı olarak aylık ve ayrıntılı besin raporları görmek istiyorum. | C (Premium) |

### 4.8 `WGT` — Kilo takibi

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| WGT-01 | Kullanıcı olarak kilomu kaydetmek ve zaman içindeki değişimi grafikte görmek istiyorum. | M |
| WGT-02 | Kullanıcı olarak kilom değiştikçe günlük hedeflerimin yeniden hesaplanmasını istiyorum. | M |
| WGT-03 | Kullanıcı olarak Apple Health / Health Connect ile kilo ve aktivite verimi senkronize etmek istiyorum. | C |

### 4.9 `SUB` — Abonelik ve ödeme

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| SUB-01 | Ücretsiz kullanıcı olarak günde belirli sayıda kamera taraması yapabilmek istiyorum. | M |
| SUB-02 | Kullanıcı olarak limitim dolduğunda Premium'un ne sağladığını görmek ve abone olabilmek istiyorum. | M |
| SUB-03 | Kullanıcı olarak aylık veya yıllık abonelik seçebilmek istiyorum. | M |
| SUB-04 | Kullanıcı olarak telefonu değiştirdiğimde aboneliğimi geri yükleyebilmek istiyorum. | M |
| SUB-05 | Kullanıcı olarak Premium'u ücretsiz deneme süresiyle denemek istiyorum. | S |

**İş kuralları**
- Ödemeler App Store ve Google Play uygulama içi satın alma ile yapılır (dijital içerik için mağaza zorunluluğu).
- Günlük ücretsiz tarama sayısı, fiyatlar ve deneme süresi [business-model.md](business-model.md) dokümanında belirlenecektir. (Taslak: günde 3 ücretsiz tarama.)
- Tarama limiti **sunucu tarafında** uygulanır; istemci tarafındaki sayaç yalnızca gösterim içindir.

### 4.10 `NOTIF` — Bildirimler

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| NOTIF-01 | Kullanıcı olarak öğün saatlerinde kayıt hatırlatması almak istiyorum (saatleri ben belirlerim). | S |
| NOTIF-02 | Kullanıcı olarak kilo tartılma hatırlatması almak istiyorum. | C |

### 4.11 `PRIV` — Gizlilik, izinler ve veri yönetimi

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| PRIV-01 | Kullanıcı olarak kayıt olurken KVKK aydınlatma metnini görmek ve sağlık verilerimin işlenmesine açık rıza vermek istiyorum. | M |
| PRIV-02 | Kullanıcı olarak fotoğraflarımın yapay zekâ eğitiminde kullanılmasına **ayrıca ve isteğe bağlı olarak** izin vermek istiyorum. | M |
| PRIV-03 | Kullanıcı olarak verdiğim izinleri ayarlardan istediğim zaman geri alabilmek istiyorum. | M |
| PRIV-04 | Kullanıcı olarak tüm verimi dışa aktarabilmek istiyorum. | S |

**İş kuralları**
- Kilo, boy ve beslenme kayıtları KVKK kapsamında **özel nitelikli kişisel veri (sağlık verisi)** sayılabilir; açık rıza ve ek güvenlik önlemleri gerekir.
- Aşama 1'de fotoğraflar yurt dışındaki bir LLM sağlayıcısına gönderileceği için **yurt dışına veri aktarımı** kuralları değerlendirilmelidir.
- Eğitim izni vermeyen kullanıcıların fotoğrafları tanıma işleminden sonra saklanmaz.
- Ayrıntılar: [`07-security-privacy/`](../07-security-privacy/) *(hazırlanacak)*

### 4.12 `SET` — Ayarlar ve profil

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| SET-01 | Kullanıcı olarak kişisel bilgilerimi ve hedefimi güncelleyebilmek istiyorum. | M |
| SET-02 | Kullanıcı olarak birim tercihimi (kg/lb, cm/ft) seçebilmek istiyorum. | S |
| SET-03 | Kullanıcı olarak uygulama dilini seçebilmek istiyorum (başlangıçta Türkçe ve İngilizce). | S |
| SET-04 | Kullanıcı olarak açık/koyu tema seçebilmek istiyorum. | S |

### 4.13 MVP sonrası (`FRIDGE`, `MAP`)

| ID | Kullanıcı hikâyesi | Öncelik |
|---|---|---|
| FRIDGE-01 | Kullanıcı olarak buzdolabımın fotoğrafını çekip içindeki malzemelerin tanınmasını istiyorum. | C |
| FRIDGE-02 | Kullanıcı olarak bu malzemelerle yapabileceğim ve kalori hedefime uyan tarifleri görmek istiyorum. | C |
| MAP-01 | Kullanıcı olarak yakınımdaki sağlıklı seçenekler sunan restoranları haritada görmek istiyorum. | C |

---

## 5. Fonksiyonel olmayan gereksinimler (NFR)

| ID | Alan | Gereksinim |
|---|---|---|
| NFR-01 | Performans | Uygulama soğuk açılışta 2 saniye içinde kullanılabilir olmalı (orta seviye cihaz). |
| NFR-02 | Performans | Arama sonuçları her tuş vuruşundan sonra 300 ms içinde gelmeli. |
| NFR-03 | Performans | Tarama sonucu: Aşama 1'de ≤ 3 sn (bulut), Aşama 2'de ≤ 1 sn (cihaz üzerinde). |
| NFR-04 | Doğruluk | Tanıma doğruluğu ve kalori hatası ölçülerek raporlanır; hedefler ML Design Doc'ta tanımlanır. Ölçüm, Türk yemeklerinden oluşan sabit bir test seti üzerinde yapılır. |
| NFR-05 | Uyumluluk | iOS 16+ ve Android 9 (API 28)+ desteklenir *(nihai değerler kullanıcı cihaz dağılımına göre güncellenecek)*. |
| NFR-06 | Erişilebilirlik | Dinamik yazı boyutu, ekran okuyucu etiketleri, WCAG AA kontrast. |
| NFR-07 | Yerelleştirme | Tüm metinler çeviri dosyalarından gelir; kodda sabit metin bulunmaz. Türkçe karakterler aramada ve sıralamada doğru işlenir. |
| NFR-08 | Güvenlik | Tüm iletişim TLS üzerinden yapılır; LLM ve diğer API anahtarları istemcide bulunmaz; kimlik doğrulama token tabanlıdır. |
| NFR-09 | Gizlilik | Sağlık verisi şifreli saklanır; veri silme talepleri 30 gün içinde tamamen uygulanır. |
| NFR-10 | Güvenilirlik | Backend aylık %99,5 erişilebilirlik hedefler; tanıma servisi çalışmadığında kullanıcı arama ile kayda yönlendirilir. |
| NFR-11 | Maliyet | Tarama başına bulut maliyeti izlenir ve kullanıcı başına aylık maliyet takip edilir. |
| NFR-12 | Gözlemlenebilirlik | Çökme raporlama, performans izleme ve ürün analitiği ilk sürümden itibaren aktiftir. |

## 6. Kapsam dışı (şimdilik)

- Web uygulaması
- Diyetisyen paneli veya diyetisyenle görüşme
- Sosyal özellikler (arkadaş ekleme, paylaşım, akış)
- Akıllı saat uygulaması
- Tıbbi beslenme planları (diyabet, böbrek hastalığı vb.)

## 7. Varsayımlar ve bağımlılıklar

- TürKomp verilerinin ticari kullanımı için izin alınabileceği varsayılmaktadır; alınamazsa alternatif kaynaklar (USDA + kendi tariflerimiz) kullanılır.
- Aşama 1'de kullanılacak görsel LLM, test setimizde yapılacak karşılaştırmayla seçilecektir.
- App Store ve Google Play geliştirici hesapları açılacaktır.

## 8. Açık sorular

| # | Soru | Karar sahibi |
|---|---|---|
| 1 | Ücretsiz günlük tarama sayısı ve Premium fiyatı ne olacak? | Ürün ekibi — business-model.md |
| 2 | MVP'de barkod olacak mı? | Geliştirme sırasında |
| 3 | Minimum yaş sınırı ne olacak (16 mı, 18 mi)? | Hukuki inceleme |
| 4 | Aşama 1'de hangi LLM kullanılacak? | LLM karşılaştırma testi |
| 5 | İngilizce dil desteği MVP'de olacak mı? | Ürün ekibi |

## 9. Değişiklik geçmişi

| Tarih | Sürüm | Değişiklik |
|---|---|---|
| 23.10.2026 | 0.1 | İlk taslak. Kararlar: ilk pazar Türkiye; iOS + Android; React Native; freemium; Apple/Google/e-posta ile giriş. |
