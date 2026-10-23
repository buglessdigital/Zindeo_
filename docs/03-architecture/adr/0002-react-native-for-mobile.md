# ADR-0002: Mobil uygulama için React Native

| | |
|---|---|
| **Durum** | Kabul edildi |
| **Tarih** | 23.10.2026 |
| **Karar verenler** | Taner Yıldırım |

## Bağlam

- Zindeo iOS ve Android'de aynı anda yayınlanacak ([Vision §8](../../01-product/vision.md)). Türk yemeğine odaklanan en yakın rakiplerin yalnızca iOS'ta olması bizim için bir fark yaratıyor.
- Ekip üç kişi; iki ayrı native kod tabanını sürdürecek kapasitemiz yok.
- Uygulama kamera, barkod okuma, uygulama içi satın alma ve Apple/Google ile giriş kullanacak (`SCAN`, `BAR`, `SUB`, `AUTH`).
- Aşama 2'de PyTorch ile eğitilen model telefonda çalışacak (`SCAN-08`). Bunun için native bir modül gerekecek.

## Karar

Mobil uygulama **React Native** ile, **TypeScript** kullanılarak, **Expo** üzerine kurulacak.

- Expo Go yerine **development build** kullanılacak. Bu sayede ileride cihaz üzerindeki ML modeli için native modül eklenebilir.
- iOS/Android build'leri ve mağaza gönderimi için **EAS Build / EAS Submit** kullanılacak.

## Değerlendirilen alternatifler

| Seçenek | Artıları | Eksileri |
|---|---|---|
| **React Native** | Tek kod tabanı; TypeScript/JavaScript ekosistemi; Supabase'in resmî JS istemcisi; geniş topluluk | Cihaz üzerindeki ML modelini çalıştırmak için native köprü gerekir |
| Flutter | Tek kod tabanı; yüksek performanslı arayüz; TFLite eklentileri olgun | Dart öğrenmek gerekir; ekip tercihi React Native yönünde |
| Expo'suz (bare) React Native | Tam kontrol | Native build ayarları, kamera ve giriş modülleri, mağaza gönderimi gibi işler elle yapılır; Expo development build ile native modül zaten eklenebildiği için ek faydası yok |
| Native (Swift + Kotlin) | En iyi performans ve platform erişimi | İki ayrı kod tabanı; üç kişilik ekip için iş yükü iki katına çıkar |

## Sonuçlar

- iOS ve Android aynı anda geliştirilir ve yayınlanır.
- Aşama 2'de cihaz üzerinde model çalıştırmak için uygun bir çalışma zamanı (LiteRT, ExecuTorch vb.) ve native modül seçilecektir. Bu, ayrı bir ADR konusudur.
- Uygulama, tanıma servisini bir arayüz (`FoodRecognizer`) arkasında kullanacak şekilde yazılır. Böylece bulut LLM'den cihaz üzerindeki modele geçiş arayüzü etkilemez.
