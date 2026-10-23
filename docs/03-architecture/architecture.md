# Zindeo — Mimari Dokümanı

| | |
|---|---|
| **Durum** | Taslak v0.1 |
| **Sahibi** | Taner Yıldırım |
| **Son güncelleme** | 23 Ekim 2026 |
| **İlgili** | [PRD](../01-product/prd.md) · [ADR'ler](adr/) |

---

## 1. Amaç ve kapsam

Bu doküman Zindeo'nun **nasıl inşa edileceğini** üst seviyede tanımlar: sistemin parçaları, aralarındaki ilişkiler, kritik akışlar ve bu yapıyı yönlendiren ilkeler. Diyagramlar [C4 modeli](https://c4model.com/) seviyelerine göre düzenlenmiştir:

1. **Sistem bağlamı:** Zindeo ve dış dünya
2. **Container'lar:** Zindeo'yu oluşturan çalıştırılabilir parçalar
3. **Bileşenler:** Mobil uygulamanın ve backend'in iç yapısı

Ayrıntılar ilgili dokümanlarda yer alır: veri modeli (`04-data/`), API sözleşmesi (`05-api/`), ML tarafı (`06-ml/`).

## 2. Mimariyi yönlendiren etkenler

| Etken | Kaynak | Mimariye etkisi |
|---|---|---|
| iOS + Android, küçük ekip | ADR-0002 | Tek kod tabanı: React Native + Expo |
| Tek backend sağlayıcısı | ADR-0003 | Tüm sunucu tarafı Supabase'te |
| Tanıma motoru değişecek (LLM → kendi modelimiz) | Vision §6 | Tanıma, `FoodRecognizer` arayüzünün arkasında |
| Besin değerleri tutarlı olmalı | PRD `FOOD`, `SCAN` | Kalori ve makrolar yalnızca Zindeo veritabanından hesaplanır |
| API anahtarı istemcide olamaz, tarama limiti atlatılamaz | NFR-08, `SUB-01` | LLM çağrısı ve limit kontrolü Edge Function'da |
| Sağlık verisi | `PRIV`, NFR-09 | RLS ile kullanıcı bazında erişim; özel (private) dosya deposu |
| Kayıt 10 saniyeden kısa sürmeli | Vision §10 | Arama hızlı olmalı; sık kullanılanlar önde; iyimser (optimistic) arayüz güncellemeleri |

## 3. Seviye 1 — Sistem bağlamı

```mermaid
flowchart TB
    user(["👤 Kullanıcı<br/>Diyet / spor yapan kişi"])

    subgraph zindeo["Zindeo"]
        sys["Zindeo sistemi<br/>Mobil uygulama + Supabase backend"]
    end

    llm["Görsel LLM sağlayıcısı<br/>(Aşama 1: fotoğraftan yemek tanıma)"]
    stores["App Store / Google Play<br/>(uygulama içi satın alma)"]
    idp["Apple / Google<br/>(kimlik sağlayıcı)"]
    off["Open Food Facts<br/>(barkodlu ürün verisi)"]
    push["Expo Push Service<br/>(APNs / FCM)"]

    user -->|"öğün kaydeder, fotoğraf çeker,<br/>ilerlemesini izler"| sys
    sys -->|"fotoğraf + yemek listesi →<br/>yemek ID'leri + gramaj"| llm
    sys -->|"abonelik satın alma<br/>ve doğrulama"| stores
    sys -->|"giriş"| idp
    sys -->|"barkod sorgusu"| off
    sys -->|"hatırlatma bildirimi"| push
    push --> user
```

| Dış sistem | Ne için | Not |
|---|---|---|
| Görsel LLM | Aşama 1'de fotoğraftan yemek tanıma | Sağlayıcı, test setinde karşılaştırma ile seçilecek (açık karar) |
| App Store / Google Play | Abonelik satışı ve makbuz doğrulama | Dijital içerik için mağaza ödemesi zorunlu |
| Apple / Google | Sosyal giriş | Supabase Auth üzerinden |
| Open Food Facts | Barkodlu ürünler (`BAR`) | Bulunan ürün kendi veritabanımıza kopyalanır (ODbL koşullarıyla) |
| Expo Push Service | Bildirimler (`NOTIF`) | Expo'nun parçası; ayrı bir backend değil |

## 4. Seviye 2 — Container'lar

```mermaid
flowchart TB
    user(["👤 Kullanıcı"])

    subgraph device["📱 Kullanıcının telefonu"]
        app["Mobil uygulama<br/><i>React Native · Expo · TypeScript</i><br/>Arayüz, hedef hesaplama,<br/>yerel önbellek"]
        localdb[("Yerel depo<br/><i>SQLite</i><br/>Çevrimdışı kayıtlar,<br/>sık yemekler")]
        ondevice["Cihaz üzerindeki model<br/><i>Aşama 2</i>"]
    end

    subgraph supa["☁️ Supabase (Frankfurt)"]
        auth["Supabase Auth<br/>Apple · Google · e-posta"]
        api["Data API (PostgREST)<br/>CRUD, RLS ile korunur"]
        db[("Postgres<br/>Besin kataloğu, öğün kayıtları,<br/>profil, kilo, abonelik, kota")]
        fn["Edge Functions<br/><i>Deno · TypeScript</i><br/>scan · barcode · subscription ·<br/>account-delete"]
        storage[("Storage<br/>scan-images (private)")]
    end

    llm["Görsel LLM"]
    stores["App Store / Google Play"]
    off["Open Food Facts"]

    user --> app
    app <--> localdb
    app -.->|Aşama 2| ondevice
    app -->|"oturum / JWT"| auth
    app -->|"HTTPS + JWT"| api
    app -->|"HTTPS + JWT"| fn
    api --> db
    fn --> db
    fn --> storage
    fn --> llm
    fn --> stores
    fn --> off
```

| Container | Teknoloji | Sorumluluk |
|---|---|---|
| **Mobil uygulama** | React Native, Expo, TypeScript | Tüm arayüz; hedef hesaplama; kamera; okuma ve basit yazma işlemlerinde doğrudan Data API kullanımı |
| **Yerel depo** | SQLite (Expo) | Çevrimdışı kayıt kuyruğu (`LOG-06`), son ve sık kullanılan yemeklerin önbelleği |
| **Supabase Auth** | Supabase | Kayıt, giriş, oturum yenileme; JWT üretimi |
| **Data API** | PostgREST (Supabase) | Basit CRUD: öğün kaydı, kilo, profil, katalog okuma. Güvenliği RLS sağlar |
| **Postgres** | Supabase Postgres | Tek doğruluk kaynağı. Arama için `pg_trgm` ve `unaccent`; atomik işlemler için RPC fonksiyonları |
| **Edge Functions** | Deno, TypeScript | Sır (secret) gerektiren veya güvenilmemesi gereken işler: LLM çağrısı, tarama kotası, makbuz doğrulama, barkod sorgusu, hesap silme |
| **Storage** | Supabase Storage | Tarama fotoğrafları. Bucket private, erişim imzalı URL ile |

### Data API mi, Edge Function mı?

| Kural | Örnek |
|---|---|
| Kullanıcının kendi verisini okuyan/yazan, sır gerektirmeyen basit işlemler → **Data API + RLS** | Öğün kaydı ekleme, kilo girme, katalogda arama |
| Birden fazla tabloyu tutarlı biçimde değiştiren işlemler → **Postgres RPC fonksiyonu** | Kopyala-yapıştır öğün, kota düşme |
| Sır, dış servis veya güvenilmeyen istemci mantığı → **Edge Function** | LLM tarama, makbuz doğrulama, hesap silme |

## 5. Seviye 3 — Bileşenler

### 5.1 Mobil uygulama

Kod, **özellik (feature) bazlı** düzenlenir. Her özellik kendi ekranlarını, hook'larını ve API çağrılarını içerir; ortak altyapı `core/` altındadır.

```mermaid
flowchart LR
    subgraph features["features/"]
        f_auth[auth]
        f_onb[onboarding]
        f_food[food-search]
        f_log[logging]
        f_scan[scan]
        f_dash[dashboard]
        f_wgt[weight]
        f_sub[subscription]
        f_set[settings]
    end

    subgraph core["core/"]
        api["api<br/>Supabase istemcisi"]
        rec["recognition<br/><b>FoodRecognizer</b> arayüzü"]
        nut["nutrition<br/>BMR/TDEE/makro,<br/>porsiyon → besin değeri"]
        i18n["i18n"]
        offline["offline<br/>SQLite + senkron kuyruğu"]
        ui["ui<br/>design system bileşenleri"]
    end

    f_scan --> rec
    f_onb --> nut
    f_log --> nut
    f_dash --> nut
    f_log --> offline
    features --> api
    features --> ui
    features --> i18n
    rec --> api
```

**`FoodRecognizer` arayüzü.** Tanıma motorunu uygulamanın geri kalanından ayıran sözleşme:

```ts
interface FoodRecognizer {
  recognize(image: ImageInput): Promise<RecognitionResult>;
}

interface RecognitionResult {
  items: Array<{
    candidates: Array<{ foodId: string; confidence: number }>; // en olası önce
    estimatedGrams: number;
  }>;
  engine: 'cloud-llm' | 'on-device';
}
```

- Aşama 1: `CloudRecognizer`, `scan` Edge Function'ını çağırır.
- Aşama 2: `OnDeviceRecognizer` modeli telefonda çalıştırır. Model emin değilse `CloudRecognizer`'a devredebilir (`HybridRecognizer`).
- Sonuçta **hiçbir zaman kalori yoktur**. Kalori ve makrolar `core/nutrition` tarafından katalog verisinden hesaplanır.

**`core/nutrition`.** Saf (yan etkisiz) TypeScript fonksiyonlarından oluşur: BMR, TDEE, kalori hedefi, makro dağılımı, `porsiyon × miktar → besin değerleri`. Birim testleri en yoğun bu modülde olacaktır. Formüller `04-data/nutrition-calculation.md` dokümanında tanımlanır.

### 5.2 Edge Functions

| Fonksiyon | Tetikleyen | Görev | PRD |
|---|---|---|---|
| `scan` | Uygulama | Kota kontrolü → fotoğrafı sakla (izin varsa) → LLM'e sor → çıktıyı katalogla doğrula → sonucu döndür | `SCAN`, `SUB-01`, `PRIV-02` |
| `scan-feedback` | Uygulama | Kullanıcının onayladığı/düzelttiği sonucu taramaya bağlar (eğitim etiketi) | `SCAN-04/05`, `PRIV-02` |
| `barcode-lookup` | Uygulama | Barkodu önce kendi veritabanında, yoksa Open Food Facts'te arar ve sonucu kataloğa ekler | `BAR-01` |
| `subscription-verify` | Uygulama | Satın alma makbuzunu Apple/Google ile doğrular, abonelik durumunu yazar | `SUB-02..04` |
| `store-webhook` | Apple / Google | Yenileme, iptal ve iade bildirimlerini işler | `SUB` |
| `account-delete` | Uygulama | Kullanıcının tüm verisini, fotoğraflarını ve auth kaydını siler | `AUTH-05` |

Ortak kod (`_shared/`): JWT doğrulama, hata formatı, loglama, LLM istemcisi.

## 6. Kritik akışlar

### 6.1 Kamera ile tarama (Aşama 1)

```mermaid
sequenceDiagram
    autonumber
    actor U as Kullanıcı
    participant A as Mobil uygulama
    participant F as Edge Function: scan
    participant DB as Postgres
    participant S as Storage
    participant L as Görsel LLM

    U->>A: Fotoğraf çeker
    A->>A: Yeniden boyutlandır ve sıkıştır (~1024 px, JPEG)
    A->>F: POST /scan (fotoğraf, JWT)
    F->>DB: Kota kontrolü ve düşme (atomik RPC)
    alt Kota dolu
        F-->>A: 402 quota_exceeded
        A-->>U: Premium ekranı (SUB-02)
    end
    opt Kullanıcı eğitim izni verdiyse (PRIV-02)
        F->>S: Fotoğrafı scan-images'a yaz
    end
    F->>L: Fotoğraf + Zindeo yemek listesi + JSON şeması
    L-->>F: [{food_id, confidence, grams}, ...]
    F->>F: ID'leri katalogla doğrula, bilinmeyenleri ele
    F->>DB: scan kaydı (sonuç, motor, süre, maliyet)
    F-->>A: RecognitionResult
    A->>A: Kaloriyi katalogdan hesapla (core/nutrition)
    A-->>U: Sonuç ekranı (emin değilse 2–3 seçenek)
    U->>A: Onaylar veya düzeltir
    A->>DB: Öğün kaydı (Data API)
    A->>F: scan-feedback (son hâli)
```

**Tasarım notları**
- **Kota, LLM çağrısından önce düşülür.** Böylece paralel isteklerle limit aşılamaz. LLM hatası olursa kota iade edilir.
- **LLM'e yemek listesi verilir ve çıktı JSON şemasıyla sınırlanır.** LLM yalnızca kataloğumuzdaki ID'leri döndürebilir. Katalogda olmayan ID'ler sunucuda elenir.
- **Fotoğraf istemcide küçültülür.** Yükleme süresi ve LLM maliyeti düşer.
- **Her tarama kaydedilir** (motor, süre, maliyet, sonuç). Bu kayıtlar maliyet takibini (NFR-11) ve Aşama 2'de LLM ile kendi modelimizin karşılaştırılmasını sağlar.
- **LLM erişilemezse** kullanıcıya hata gösterilir ve arama ekranına yönlendirilir (NFR-10).

### 6.2 Arama ile kayıt

```mermaid
sequenceDiagram
    autonumber
    actor U as Kullanıcı
    participant A as Mobil uygulama
    participant DB as Postgres (Data API / RPC)

    U->>A: "kuru fasul" yazar
    A->>A: Yerel önbellekte son/sık yemekler
    A->>DB: search_foods("kuru fasul") — debounce 150 ms
    DB-->>A: Sonuçlar (unaccent + trigram benzerliği, kullanıcı sıklığına göre sıralı)
    U->>A: Yemeği ve porsiyonu seçer (1 kase)
    A->>A: Besin değerlerini hesapla (core/nutrition)
    A->>A: Arayüzü hemen güncelle (optimistic)
    A->>DB: Öğün kaydı ekle
```

### 6.3 Kimlik doğrulama

```mermaid
sequenceDiagram
    autonumber
    actor U as Kullanıcı
    participant A as Mobil uygulama
    participant P as Apple / Google
    participant AU as Supabase Auth

    U->>A: "Apple ile devam et"
    A->>P: Native giriş penceresi
    P-->>A: ID token
    A->>AU: signInWithIdToken(token)
    AU-->>A: Oturum (access + refresh token)
    A->>A: Oturumu güvenli depoda sakla (SecureStore)
    alt Yeni kullanıcı
        A-->>U: Onboarding + KVKK açık rıza (ONB, PRIV-01)
    else Mevcut kullanıcı
        A-->>U: Günlük panel
    end
```

## 7. Veri sahipliği ve güvenlik

```mermaid
flowchart LR
    subgraph global["Ortak veri — herkes okur, yalnızca yönetici yazar"]
        foods[foods]
        portions[food_portions]
        nutrients[besin değerleri]
    end
    subgraph private["Kullanıcı verisi — RLS: user_id = auth.uid()"]
        profile[profiles]
        logs[meal_logs]
        weights[weight_logs]
        custom[user_foods]
        scans[scans]
    end
    subgraph server["Yalnızca sunucu — istemci erişemez"]
        quota[scan_quota]
        subs[subscriptions]
        consent[consents]
    end
```

- **RLS her tabloda açıktır.** Varsayılan kural: erişim yok. İzinler tablo tablo açılır.
- **Abonelik ve kota tablolarına istemci yazamaz.** Yalnızca Edge Function'lar (service role) yazar. Böylece istemci kendini Premium yapamaz.
- **Sırlar** (LLM anahtarı, mağaza anahtarları) yalnızca Edge Function ortam değişkenlerinde durur.
- **Fotoğraflar** private bucket'ta tutulur. Eğitim izni olmayan kullanıcıların fotoğrafları hiç saklanmaz.
- **Açık rıza kayıtları** (ne zaman, hangi metin sürümüne, hangi izin) denetlenebilir şekilde saklanır.

Tablo şemaları ve ilişkiler: `04-data/erd.md` *(hazırlanacak)*.

## 8. Repo yapısı

Tek repo (monorepo):

```
zindeo/
├── app/                    # Expo uygulaması
│   ├── app/                # Ekranlar (Expo Router)
│   ├── src/features/       # Özellik modülleri
│   ├── src/core/           # api, recognition, nutrition, i18n, offline, ui
│   └── locales/            # tr.json, en.json
├── supabase/               # Supabase CLI projesi
│   ├── migrations/         # Şema değişiklikleri (SQL, sürüm kontrollü)
│   ├── functions/          # Edge Functions (+ _shared/)
│   └── seed.sql            # Geliştirme verisi
├── ml/                     # PyTorch: veri hazırlama, eğitim, değerlendirme
└── docs/
```

**Kural:** Veritabanında yapılan her değişiklik bir migration dosyasıyla yapılır. Panelden elle şema değişikliği yapılmaz.

## 9. Ortamlar

| Ortam | Nerede | Kullanım |
|---|---|---|
| **Local** | Supabase CLI ile bilgisayarda | Geliştirme ve testler. Her geliştiricinin kendi veritabanı vardır |
| **Staging** | Supabase bulut projesi (ücretsiz plan) | Ekip içi testler, TestFlight / dahili test sürümleri |
| **Production** | Supabase bulut projesi (Pro plan, beta öncesi) | Gerçek kullanıcılar |

Mobil uygulama hangi ortama bağlanacağını build profiline göre (EAS: `development`, `preview`, `production`) alır.

## 10. Evrim: Aşama 2

```mermaid
flowchart LR
    cam[Fotoğraf] --> od["OnDeviceRecognizer<br/>(telefonda, internetsiz)"]
    od -->|"güven ≥ eşik"| res[Sonuç]
    od -->|"güven < eşik<br/>ve internet var"| cloud["CloudRecognizer<br/>(scan Edge Function)"]
    cloud --> res
    od -->|"güven < eşik<br/>internet yok"| opts["Kullanıcıya<br/>2–3 seçenek"]
```

Aşama 1'den 2'ye geçerken değişen tek yer `core/recognition` içindeki uygulamadır (implementation). Ekranlar, veritabanı ve `scan` akışının geri kalanı aynı kalır. Model dosyası uygulamayla birlikte gelebilir veya Supabase Storage'dan indirilebilir; bu karar ML Design Doc'ta verilecektir.

## 11. Açık kararlar (gelecek ADR'ler)

| Konu | Seçenekler | Ne zaman |
|---|---|---|
| Aşama 1 görsel LLM sağlayıcısı | Gemini, Claude, GPT vb. | Türk yemeği test setiyle karşılaştırma sonrası |
| Uygulama içi satın alma | Kendi doğrulamamız (`subscription-verify`) veya RevenueCat | `SUB` geliştirmesinden önce |
| Uygulama durumu ve veri çekme | TanStack Query + Zustand (öneri) | Uygulama iskeleti kurulurken |
| Çevrimdışı senkronizasyon yöntemi | Basit yazma kuyruğu (öneri) veya senkron kütüphanesi | `LOG-06` geliştirmesinden önce |
| Cihaz üzerinde model çalışma zamanı | LiteRT, ExecuTorch | Aşama 2 |
| Çökme raporlama ve analitik | — | Beta öncesi |
