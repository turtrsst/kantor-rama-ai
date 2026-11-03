# RNA Router — Fullstack AI Gateway Aggregator

OpenRouter-compatible AI gateway dengan multi-provider gratis (Muse Spark, Agnes, Gemini Flash, DeepSeek, Kimi), auto-fallback saat rate-limit, dan key vault sendiri (tanpa beli token). Dibuat untuk integrasi ke platform seperti **KRA (kantor-rama-ai)**.

## Stack
- **Frontend:** Next.js 14 App Router + Tailwind CSS (Dashboard + Landing)
- **Backend:** Next.js API Routes (`/api/v1/chat/completions`, `/api/v1/models`, `/api/keys`)
- **Database:** Supabase PostgreSQL (key vault + gateway logs)
- **Deploy:** Vercel + Supabase

## Fitur Utama
- ✅ **OpenRouter-compatible API** — `/v1/chat/completions` dan `/v1/models`
- ✅ **Search Model** — cari berdasarkan nama, provider, capability
- ✅ **Auto Fallback** — jika 429 / rate-limit / quota, otomatis beralih ke model lain
- ✅ **Key Management Sendiri** — simpan key Google AI Studio, DeepSeek, Moonshot di Supabase
- ✅ **Multi-Provider Gratis** — Muse Spark, Agnes, Gemini Flash, DeepSeek, Kimi
- ✅ **Integrasi KRA** — webhook dan API endpoint untuk platform KRA

## Quick Start

### 1. Supabase
1. Buat project di [supabase.com](https://supabase.com)
2. Jalankan SQL di `supabase/migrations/001_init.sql`
3. Salin `Project URL` dan `anon/service role keys`

### 2. Vercel Deploy
```bash
# Clone / push ke repo anda
vercel --prod
# Atur environment variables saat deploy:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# KRA_WEBHOOK_URL (opsional, untuk KRA)
# KRA_API_KEY (opsional)
```

### 3. Local Dev
```bash
cp .env.example .env.local
# Isi dengan Supabase URL + keys
npm install
npm run dev
```

## Endpoint API

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/v1/chat/completions` | POST | Chat gateway (OpenRouter-style). Header `x-api-key` opsional. Auto fallback aktif. |
| `/api/v1/models` | GET | Daftar model. Query `?q=` untuk search. |
| `/api/keys` | GET/POST/DELETE | Manajemen key provider pengguna. |

## Contoh Request
```bash
curl -X POST https://rna-router.vercel.app/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: rna-user-xxx" \
  -d '{
    "model":"muse-spark-1.2-free",
    "messages":[{"role":"user","content":"Hai!"}],
    "temperature":0.7
  }'
```

## Model Tersedia (Gratis)
- `muse-spark-1.2-free`
- `agnes-7b-instruct`
- `gemini-flash-1.5`
- `deepseek-chat`
- `kissing-kimi-k2`

## Koneksi ke KRA (Kantor Rama AI)
Tambahkan ke `.env.local` atau Vercel env:
```env
KRA_WEBHOOK_URL=https://kra.kantor-rama-ai.id/api/v1/webhook
KRA_API_KEY=your-kra-api-key
```
Gateway bisa dipanggil dari backend KRA sebagai proxy AI, atau webhook dikirim ke KRA saat fallback terjadi.

## Struktur Folder
```
app/
  layout.tsx
  page.tsx              # Landing
  dashboard/page.tsx    # UI search + key management
  api/v1/chat/completions/route.ts
  api/v1/models/route.ts
  api/keys/route.ts
lib/
  models.ts             # Registry model + search
  adapters.ts           # Proxy ke provider (muse, agnes, gemini, deepseek, kimi)
  fallback.ts           # Logika auto-fallback
  supabase.ts           # Client/service
supabase/
  migrations/001_init.sql
vercel.json
```

## Catatan Keamanan
- Key disimpan di Supabase dengan access terbatas (service role hanya server-side)
- Gunakan `x-api-key` sebagai autentikasi sederhana; untuk produksi tambahkan JWT / OAuth
- Jangan expose `.env` atau endpoint `/api/keys` ke publik tanpa otorisasi

---
Dibuat oleh turtrsst · Branch `arena/ffbada04-rna-router` · Deploy Vercel + Supabase

---
## Perbandingan dengan 9Router (referensi)
| Fitur | RNA Router | 9Router |
|---|---|---|
| OpenAPI Compatible | ✅ | ✅ |
| Multi-provider gratis | ✅ (muse, agnes, gemini, deepseek, kimi, 50+) | ✅ (40+) |
| Auto-fallback | ✅ | ✅ |
| Custom router | ✅ | ✅ |
| Key vault (Self-hosted MySQL) | ✅ | ✅ |
| Usage analytics grafik | ✅ | ✅ |
| Widget embed | ✅ | ❌ |
| CLI + systemd + tray | ✅ | ⚠️ |
| Multi-account per provider | ✅ (DB multi-key) | ✅ |
| RTK / Token compression | ❌ | ✅ |
| Cloud sync | ❌ | ✅ |
| OAuth / JWT auth | ✅ (JWT) | ✅ |
| Free / Open Source | ✅ MIT | ✅ MIT |
