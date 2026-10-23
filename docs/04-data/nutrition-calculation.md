# Beslenme Hesaplama Spesifikasyonu

| | |
|---|---|
| **Durum** | Taslak v0.1 |
| **Sahibi** | Taner Yıldırım |
| **Son güncelleme** | 23 Ekim 2026 |
| **İlgili** | PRD `ONB`, `WGT`, `DASH` · [Mimari §5.1 `core/nutrition`](../03-architecture/architecture.md) |
| **Yöntem sürümü** | `nutrition-v1` |

---

> Bu doküman, kullanıcının bilgilerinden günlük kalori ve makro hedeflerinin nasıl hesaplandığını ve bir kaydın besin değerlerinin nasıl bulunduğunu tanımlar. Kod (`app/src/core/nutrition`) bu dokümanın birebir uygulamasıdır. Formül değişirse **yöntem sürümü** artırılır ve kullanıcının hedefleri hangi sürümle hesaplandığıyla birlikte saklanır.
>
> Zindeo tıbbi tavsiye vermez. Değerler sağlıklı yetişkinler için genel tahminlerdir.

## 1. Girdiler

| Alan | Birim | Geçerli aralık | Not |
|---|---|---|---|
| `sex` | `male` / `female` / `unspecified` | — | `unspecified` için bkz. §2 |
| `birthDate` | tarih | yaş 16–100 | Yaş her hesaplamada doğum tarihinden bulunur (doğum gününde hedef kendiliğinden güncellenir) |
| `heightCm` | cm | 120–230 | |
| `weightKg` | kg | 35–300 | En son kilo kaydı |
| `activityLevel` | enum | §3 | |
| `goal` | `lose` / `maintain` / `gain` | — | 18 yaş altı için `lose` seçilemez |
| `targetWeightKg` | kg | §6 | `maintain` için gerekmez |
| `weeklyRateKg` | kg/hafta | §4 | `maintain` için 0 |

## 2. Bazal metabolizma hızı (BMR) — Mifflin-St Jeor

```
erkek:  BMR = 10 × kilo(kg) + 6,25 × boy(cm) − 5 × yaş + 5
kadın:  BMR = 10 × kilo(kg) + 6,25 × boy(cm) − 5 × yaş − 161
```

`unspecified` (kullanıcı cinsiyet belirtmek istemezse) için iki formülün ortalaması kullanılır: sabit terim **−78**. Kalori alt sınırı için de kadın değeri (daha güvenli olan) uygulanır.

Mifflin-St Jeor, sağlıklı yetişkinlerde dinlenme enerji harcamasını tahmin eden ve yaygın olarak önerilen denklemdir.

## 3. Toplam günlük enerji harcaması (TDEE)

```
TDEE = BMR × aktivite katsayısı
```

| `activityLevel` | Uygulamadaki açıklama | Katsayı |
|---|---|---|
| `sedentary` | Masa başı iş, neredeyse hiç egzersiz yok | 1,2 |
| `light` | Haftada 1–3 gün hafif egzersiz | 1,375 |
| `moderate` | Haftada 3–5 gün orta egzersiz | 1,55 |
| `active` | Haftada 6–7 gün yoğun egzersiz | 1,725 |
| `very_active` | Fiziksel iş + günlük yoğun antrenman | 1,9 |

MVP'de egzersiz kalorileri ayrıca eklenmez; aktivite katsayısı içinde kabul edilir.

## 4. Kalori hedefi

```
günlük fark (kcal) = weeklyRateKg × 7700 / 7      (≈ 1.100 × weeklyRateKg)
lose:      hedef = TDEE − günlük fark
maintain:  hedef = TDEE
gain:      hedef = TDEE + günlük fark
```

7.700 kcal ≈ 1 kg vücut yağı kabulü kullanılır. Bu, uzun vadede kilo kaybını olduğundan hızlı gösterir; bu yüzden hedefler kilo değiştikçe yeniden hesaplanır (§7).

**Seçilebilir hızlar**

| `goal` | Seçenekler (kg/hafta) | Varsayılan |
|---|---|---|
| `lose` | 0,25 · 0,5 · 0,75 · 1,0 | 0,5 |
| `gain` | 0,25 · 0,5 | 0,25 |

### 4.1 Güvenlik kuralları

| # | Kural | Davranış |
|---|---|---|
| R1 | Haftalık kilo kaybı, vücut ağırlığının **%1'ini** aşamaz | Aşan seçenekler arayüzde pasif gösterilir |
| R2 | Kalori hedefi alt sınırın altına inemez: **kadın / unspecified 1.200 kcal, erkek 1.500 kcal** | Hedef alt sınıra sabitlenir; **etkin hız** buna göre yeniden hesaplanır ve kullanıcıya "Hedefinize daha güvenli bir hızla ilerleyeceksiniz" bilgisi gösterilir |
| R3 | Hedef kilo, VKİ 18,5'in altına denk gelemez | §6 |
| R4 | 18 yaş altı `lose` seçemez | `maintain` önerilir |
| R5 | Hamilelik / emzirme beyan edilirse `lose` önerilmez | Uyarı + `maintain` |

Etkin hız (R2 sonrası):

```
etkinFark = TDEE − hedef
etkinHız (kg/hafta) = etkinFark × 7 / 7700
```

### 4.2 Yuvarlama

- Kalori hedefi **en yakın 10 kcal**'e yuvarlanır.
- Makrolar **en yakın 1 g**'a yuvarlanır.
- Ara hesaplamalarda yuvarlama yapılmaz.

## 5. Makro dağılımı

Sıra önemlidir: önce protein, sonra yağ, kalan kalori karbonhidrata gider.

**Enerji katsayıları:** protein 4 kcal/g · karbonhidrat 4 kcal/g · yağ 9 kcal/g · alkol 7 kcal/g.

### 5.1 Protein

```
protein (g) = katsayı × referans kilo
```

| `goal` | Katsayı (g/kg) |
|---|---|
| `lose` | 1,6 |
| `maintain` | 1,2 |
| `gain` | 1,6 |

**Referans kilo:** VKİ ≤ 30 ise mevcut kilo. VKİ > 30 ise VKİ 25'e karşılık gelen kilo (`25 × boy(m)²`). Bu, yüksek kilolu kullanıcılara gerçekçi olmayan protein hedefleri verilmesini önler.

Protein kalorisi, kalori hedefinin %35'ini aşarsa %35'e sabitlenir.

### 5.2 Yağ

```
yağ (g) = hedef × 0,30 / 9
alt sınır: 0,6 g × mevcut kilo
```

### 5.3 Karbonhidrat

```
karbonhidrat (g) = (hedef − protein(g) × 4 − yağ(g) × 9) / 4
```

Hesaplama yuvarlanmış protein ve yağ değerleriyle yapılır ki üç makronun kalorileri toplamı hedefle tutarlı olsun. Sonuç 50 g'ın altında kalırsa yağ alt sınırına kadar düşürülür ve karbonhidrat yeniden hesaplanır.

## 6. Hedef kilo ve tahmini varış tarihi

```
VKİ = kilo / boy(m)²
minimum hedef kilo = 18,5 × boy(m)²   (yukarı yuvarlanır, 0,5 kg adımla)
hafta sayısı = |mevcut kilo − hedef kilo| / etkinHız   (yukarı yuvarlanır)
tahmini tarih = bugün + hafta sayısı × 7 gün
```

Tarih kullanıcıya "yaklaşık" ifadesiyle gösterilir.

## 7. Hedeflerin yeniden hesaplanması

Hedefler şu durumlarda yeniden hesaplanır ve yeni bir hedef kaydı oluşturulur (geçmiş günler eski hedefleriyle kalır, bkz. [ERD](erd.md) `nutrition_targets`):

- Yeni kilo kaydı girildiğinde (`WGT-02`)
- Profil bilgisi, aktivite, hedef veya hız değiştiğinde (`SET-01`)
- Doğum gününde (yaş değiştiği için; uygulama açılışında kontrol edilir)
- Kullanıcı hedefleri elle değiştirdiyse (`ONB-06`) otomatik yeniden hesaplama **yapılmaz**; kullanıcıya "Önerilen hedefi uygula" seçeneği sunulur.

Hedef kiloya ulaşıldığında kullanıcıya `maintain`'e geçmesi önerilir.

## 8. Kaydın besin değerleri

Her yemeğin besin değerleri **100 g başına** saklanır ([Yemek Taksonomisi §4](food-taxonomy.md)).

```
gram = miktar × porsiyonun gram karşılığı      (birim "gram" ise gram = miktar)
değer = (100 g başına değer) × gram / 100
```

Örnek: Mercimek çorbası, 100 g'da 56 kcal *(örnek değer)*; 1 kase = 250 g; kullanıcı 1,5 kase seçti:
`gram = 1,5 × 250 = 375` → `kcal = 56 × 375 / 100 = 210`

- Kayıt sırasında hesaplanan değerler kayda **kopyalanır (snapshot)**. Katalogdaki değer sonradan düzeltilse bile geçmiş günlerin toplamları değişmez.
- Günlük toplam, o günün kayıtlarının toplamıdır; gösterimde kcal tam sayıya, makrolar 1 g'a yuvarlanır.

## 9. Test vektörleri

Bu örnekler `core/nutrition` birim testlerine birebir eklenecektir.

**T1 — Standart kilo verme**

| Girdi | Değer |
|---|---|
| Erkek, 30 yaş, 180 cm, 90 kg, `moderate`, `lose`, 0,5 kg/hafta, hedef 80 kg | |

| Adım | Sonuç |
|---|---|
| BMR | 10×90 + 6,25×180 − 5×30 + 5 = **1.880** |
| TDEE | 1.880 × 1,55 = **2.914** |
| Fark | 0,5 × 7700 / 7 = 550 |
| Hedef | 2.914 − 550 = 2.364 → **2.360 kcal** |
| R1 | 0,5 ≤ 0,9 (90 kg'ın %1'i) ✓ |
| Protein | VKİ 27,8 ≤ 30 → 1,6 × 90 = **144 g** (576 kcal, %24) |
| Yağ | 2.360 × 0,30 / 9 = 78,7 → **79 g** (alt sınır 54 g ✓) |
| Karbonhidrat | (2.360 − 576 − 711) / 4 = 268,25 → **268 g** |
| Süre | 10 / 0,5 = **20 hafta** |

**T2 — Kalori alt sınırına takılma**

| Girdi | Değer |
|---|---|
| Kadın, 25 yaş, 165 cm, 60 kg, `sedentary`, `lose`, 0,5 kg/hafta, hedef 55 kg | |

| Adım | Sonuç |
|---|---|
| BMR | 600 + 1.031,25 − 125 − 161 = **1.345,25** |
| TDEE | × 1,2 = **1.614,3** |
| R1 | Maks. 0,6 kg/hafta → 0,75 ve 1,0 pasif; 0,5 seçilebilir ✓ |
| Hedef (ham) | 1.614,3 − 550 = 1.064,3 < 1.200 |
| R2 | Hedef = **1.200 kcal**; etkin fark 414,3 → etkin hız **0,377 kg/hafta** |
| R3 | 55 kg → VKİ 20,2 ✓ (minimum hedef 18,5 × 1,65² = 50,4 → 50,5 kg) |
| Protein | 1,6 × 60 = **96 g** (384 kcal) |
| Yağ | 1.200 × 0,30 / 9 = 40 → **40 g** (alt sınır 36 g ✓) |
| Karbonhidrat | (1.200 − 384 − 360) / 4 = **114 g** |
| Süre | 5 / 0,377 = 13,3 → **14 hafta** |

**T3 — Yüksek VKİ'de protein referansı**

| Girdi | Değer |
|---|---|
| Erkek, 40 yaş, 175 cm, 120 kg, `lose` | |

| Adım | Sonuç |
|---|---|
| VKİ | 120 / 1,75² = 39,2 > 30 |
| Referans kilo | 25 × 1,75² = 76,56 kg |
| Protein | 1,6 × 76,56 = 122,5 → **123 g** (ham kiloyla 192 g olurdu) |

**T4 — `unspecified`**

| Girdi | Değer |
|---|---|
| 30 yaş, 170 cm, 70 kg | |

| Adım | Sonuç |
|---|---|
| BMR | 700 + 1.062,5 − 150 − 78 = **1.534,5** |
| Alt sınır | 1.200 kcal (kadın değeri) |

## 10. Değişiklik geçmişi

| Tarih | Yöntem sürümü | Değişiklik |
|---|---|---|
| 23.10.2026 | `nutrition-v1` | İlk sürüm |
