# Zindeo Dokümantasyonu

Zindeo'nun tüm ürün, tasarım, mühendislik ve operasyon dokümanları bu klasörde Markdown olarak tutulur. Diyagramlar Mermaid ile yazılır; GitHub ve VS Code'da doğrudan görüntülenir.

**Kural:** Bir karar değiştiğinde ilgili doküman da aynı commit'te güncellenir. Doküman ile kod çelişirse doküman hatalıdır ve düzeltilir.

## Doküman haritası

Durum: ✅ hazır · 📝 taslak · ⏳ hazırlanacak

| Alan | Doküman | Durum |
|---|---|---|
| **01 Ürün** | [Product Vision](01-product/vision.md) | 📝 |
| | [PRD — Ürün Gereksinimleri](01-product/prd.md) | 📝 |
| | Personalar ve kullanıcı yolculukları | ⏳ |
| | İş modeli ve fiyatlandırma | ⏳ |
| | Başarı metrikleri | ⏳ |
| **02 Tasarım** | Bilgi mimarisi ve ekran haritası | ⏳ |
| | Kullanıcı akışları | ⏳ |
| | Design system | ⏳ |
| **03 Mimari** | Mimari dokümanı (C4) | ⏳ |
| | [ADR'ler — Mimari karar kayıtları](03-architecture/adr/) | 📝 3 kayıt |
| **04 Veri** | Veri modeli / ERD | ⏳ |
| | Beslenme hesaplama spesifikasyonu | ⏳ |
| | Yemek taksonomisi | ⏳ |
| **05 API** | OpenAPI spesifikasyonu | ⏳ |
| **06 ML** | ML Design Doc | ⏳ |
| | Veri toplama ve etiketleme kılavuzu | ⏳ |
| | Değerlendirme protokolü | ⏳ |
| **07 Güvenlik ve gizlilik** | KVKK, açık rıza, tehdit modeli, veri saklama | ⏳ |
| **08 Kalite** | Test stratejisi | ⏳ |
| **09 Operasyon** | Ortamlar, CI/CD, yayın süreci, analytics planı | ⏳ |
| **10 Proje** | Yol haritası, risk kaydı | ⏳ |
| **Araştırma** | [Rakipler ve literatür (Excel)](research/Zindeo_Rakipler_ve_Literatur.xlsx) | ✅ |
| **Ders** | [COMP 4910 PAF](course/COMP4910_PAF_Zindeo.docx) | ✅ |

## Önerilen okuma sırası

1. [Product Vision](01-product/vision.md): ne yapıyoruz ve neden
2. [PRD](01-product/prd.md): tam olarak ne yapacağız
3. Mimari dokümanı: nasıl yapacağız *(hazırlanacak)*
