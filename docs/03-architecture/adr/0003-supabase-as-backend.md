# ADR-0003: Backend olarak Supabase

| | |
|---|---|
| **Durum** | Kabul edildi |
| **Tarih** | 23.10.2026 |
| **Karar verenler** | Taner Yıldırım |

## Bağlam

Backend'in karşılaması gereken ihtiyaçlar:

- Apple, Google ve e-posta ile kimlik doğrulama (`AUTH-01..03`)
- İlişkisel veri: besin veritabanı, porsiyon birimleri, öğün kayıtları, kilo geçmişi, kullanıcı profili (`FOOD`, `LOG`, `WGT`)
- Türkçe karakterlere duyarsız ve yazım hatalarına toleranslı arama (`FOOD-02`)
- LLM API anahtarını istemciden uzak tutan bir sunucu katmanı ve sunucu tarafında uygulanan tarama limiti (`SCAN`, `SUB`, NFR-08)
- Fotoğraf depolama (`SCAN`, `PRIV-02`)
- Sağlık verisi için kullanıcı bazında erişim kontrolü (`PRIV`, NFR-09)
- Hesap ve veri silme (`AUTH-05`)

Ekip küçük. Altyapıyı birden fazla sağlayıcıya dağıtmak operasyon yükünü artırır.

## Karar

Zindeo'nun backend'i **yalnızca Supabase** üzerinde kurulacak. Ayrı bir bulut sağlayıcısı (AWS, GCP vb.) kullanılmayacak.

| İhtiyaç | Supabase bileşeni |
|---|---|
| Kimlik doğrulama | Supabase Auth (Apple, Google, e-posta) |
| Veritabanı | Postgres. Arama için `unaccent` ve `pg_trgm` eklentileri |
| Erişim kontrolü | Row Level Security (her kullanıcı yalnızca kendi verisini görür) |
| Sunucu mantığı | Edge Functions (LLM proxy, tarama limiti, abonelik doğrulama, hesap silme) |
| Dosyalar | Supabase Storage (tarama fotoğrafları; gerekirse ML veri seti) |

**Bölge:** Frankfurt (`eu-central-1`). Türkiye'ye düşük gecikme sağlar.

**Ortamlar ve plan:**
- Geliştirme sürecinde **ücretsiz plan** kullanılır.
- İlk gerçek kullanıcılardan (beta dahil) önce üretim projesi **Pro plana** geçirilir. Gerekçe: ücretsiz planda otomatik yedekleme yoktur ve proje bir hafta işlem görmezse duraklatılır. Sağlık verisi tutan bir üründe bu ikisi de kabul edilemez.

## Değerlendirilen alternatifler

| Seçenek | Artıları | Eksileri |
|---|---|---|
| **Supabase** | Auth, Postgres, Storage ve fonksiyonlar tek yerde; Postgres standart ve taşınabilir; RLS ile veritabanı seviyesinde güvenlik; ekip aşina | Ücretsiz plan kısıtlı (yedek yok, duraklatma); Edge Functions Deno tabanlı |
| AWS (Cognito, RDS, Lambda, S3) | Sektörde en yaygın platform; sınırsız esneklik | Aynı yapıyı kurmak haftalar sürer. Temmuz 2025 sonrası açılan hesaplarda ücretsiz plan 6 ay ya da 200 $ kredi ile sınırlı, yayına kadar yetmez |
| Firebase | Mobil için olgun; ücretsiz katmanı cömert | NoSQL (Firestore) ilişkisel besin verisi ve raporlama için uygun değil; Google ekosistemine bağımlılık |
| Kendi sunucumuz (Node/Python + Postgres) | Tam kontrol | Auth, güvenlik, yedekleme ve ölçekleme tamamen bize kalır; küçük ekip için gereksiz yük |

## Sonuçlar

- Auth, veri, dosya ve sunucu mantığı tek bir panelden yönetilir; operasyon yükü düşük kalır.
- Veritabanı standart Postgres olduğu için ileride başka bir sağlayıcıya taşınmak mümkündür.
- Yayından önce Pro plan için aylık maliyet (yaklaşık 25 $) bütçeye eklenmelidir.
- Model eğitimi (PyTorch) backend'in parçası değildir. Eğitim ortamı ML Design Doc'ta ayrıca belirlenecektir.
- Backend dışındaki üçüncü taraf araçlar (abonelik yönetimi, çökme raporlama, analitik) bu ADR'nin kapsamında değildir. Gerekirse ayrı ADR'lerle değerlendirilecektir.
