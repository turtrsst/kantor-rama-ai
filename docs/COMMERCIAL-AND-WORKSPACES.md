# KRA Multiuser, Workspace, Paket Creator & Memori Obsidian

Dokumen ini adalah acuan operasional untuk mode multi-pengguna Kantor-Rama-AI
(KRA): siapa boleh membuka Content Creator, bagaimana data antar-workspace
dipisahkan, di mana aplikasi pengguna disimpan, dan bagaimana memori jangka
panjang Obsidian bekerja tanpa membuat agent kehilangan konteks percakapan.

> Prinsip utamanya: **browser hanya menampilkan hak akses; server yang
> memutuskan.** Menyembunyikan tombol Creator tidak pernah dianggap sebagai
> pengaman. Setiap API Creator, YouTube, N100N/Concat, Telegram, workflow,
> proyek, Vault, provider, dan billing memeriksa user, workspace, role, serta
> entitlement lagi di sisi PHP.

---

## 1. Keputusan akses Creator

Content Creator hanya terbuka melalui salah satu jalur berikut:

1. **Admin SIAS persis** — nilai `users.role` yang dinormalisasi adalah
   `admin`, `administrator`, `superadmin`, atau `super admin`.
2. **Pemilik workspace memiliki langganan Creator aktif** — PRO, PLUS, atau
   PLATINUM, termasuk trial/grace yang masih sah.
3. **Lisensi offline bertanda tangan** yang masih berlaku dan binding-nya cocok.

Role operasional seperti `supervisor`, `boss`, atau `owner` **tidak otomatis
melewati billing**. Mereka tetap dapat menjalankan fungsi Office/non-billing
sesuai izinnya, tetapi tidak mendapat Creator gratis hanya karena disebut
supervisor.

### Identitas billing adalah pemilik workspace

Paket mengikuti **pemilik workspace**, bukan orang yang sedang membuka halaman.
Anggota yang diundang memakai paket pemilik selama berada di workspace
tersebut. Ini mencegah anggota membawa paket pribadinya ke workspace orang
lain dan mencegah workspace gratis “menumpang” paket seorang anggota.

Admin SIAS dan workspace yang pemiliknya admin SIAS menerima entitlement
setara PLATINUM tanpa batas paket.

---

## 2. Katalog paket

Harga di bawah ini adalah satu-satunya sumber kebenaran di
`api/lib/KraEntitlements.php`; UI membaca katalog dari server.

| Paket | Bulanan | Tahunan | Posisi |
| --- | ---: | ---: | --- |
| KRA OFFICE | Rp0 | Rp0 | Virtual Office dasar |
| **KRA PRO** | **Rp9.000** | **Rp100.000** | Creator Essential untuk kreator solo |
| **KRA PLUS** | **Rp15.000** | **Rp150.000** | Creator Production dengan automasi & memori pintar |
| **KRA PLATINUM** | **Rp50.000** | **Rp500.000** | Full service untuk tim & bisnis konten |

Ketentuan umum:

- Trial: **7 hari PRO**, satu kali per pengguna.
- KRA API Key hanya untuk paket berbayar aktif/lisensi offline berbayar; trial
  gratis belum dapat membuat atau memakai key.
- Grace langganan: **3 hari** setelah periode berakhir.
- Grace lisensi offline: **7 hari**.
- Paket adalah lisensi fitur KRA. Biaya model AI tidak termasuk: pengguna
  memakai Ollama lokal atau API key/provider miliknya sendiri (**BYOK**).
- Checkout saat ini adalah **permintaan aktivasi manual** atau adapter webhook
  bertanda tangan generik. Itu bukan klaim bahwa payment gateway tertentu
  sudah live; gateway nyata harus dikonfigurasi dan diuji terpisah.

### Perbedaan fitur

| Kemampuan | OFFICE | PRO | PLUS | PLATINUM |
| --- | :---: | :---: | :---: | :---: |
| Virtual Office | ✓ | ✓ | ✓ | ✓ |
| KRA API Key workspace (scope, expiry, rotate/revoke) | — | ✓ | ✓ | ✓ |
| Content Creator Studio + 4 specialist bawaan | — | ✓ | ✓ | ✓ |
| Studio Crew mode paralel | — | ✓ | ✓ | ✓ |
| 6 Creator skill inti | — | ✓ | ✓ | ✓ |
| Semua 11 Creator skills | — | — | ✓ | ✓ |
| Mode Diskusi berurutan | — | — | ✓ | ✓ |
| Agent Creator kustom | — | — | ✓ | ✓ |
| YouTube connect/upload | — | ✓ | ✓ | ✓ |
| Analytics total 28 hari | — | ✓ | ✓ | ✓ |
| Analytics per-video/lanjutan | — | — | ✓ | ✓ |
| N100N + Concat bridge | — | — | ✓ | ✓ |
| Telegram notifications | — | ✓ | ✓ | ✓ |
| Telegram approvals | — | — | ✓ | ✓ |
| Vault manual + basic recall | ✓ | ✓ | ✓ | ✓ |
| Semantic memory + auto-compile | — | — | ✓ | ✓ |
| Workflow Creator lanjutan | — | — | ✓ | ✓ |
| Full-service onboarding/health check/priority | — | — | — | ✓ |

### Batas paket

| Batas | OFFICE | PRO | PLUS | PLATINUM |
| --- | ---: | ---: | ---: | ---: |
| Workspace per pemilik | 1 | 1 | 3 | 10 |
| Proyek per workspace | 3 | 3 | 15 | 50 |
| Seat/member per workspace | 1 | 1 | 3 | 5 |
| Agent kustom | 3 | 3 | 20 | 100 |
| KRA API Key aktif per workspace | 0 | 3 | 10 | 25 |
| Upload YouTube/bulan | 0 | 30 | 120 | 500 |
| Run N100N/bulan | 0 | 0 | 500 | 2.500 |
| Kompilasi memori/bulan | 10 | 30 | 200 | 1.000 |

Fitur PLATINUM `full_service_onboarding`, `full_service_health_check`, dan
`priority_support` adalah entitlement layanan. Software membuka kapasitas dan
jalur prioritasnya; pelaksanaan onboarding/diagnosis oleh pemilik layanan
tetap merupakan proses dukungan manusia, bukan tombol ajaib.

---

## 3. Workspace dan peran member

Satu workspace adalah batas isolasi untuk:

- chat dan riwayat agent;
- tasks, proposals, workflows, dan execution records;
- proyek terdaftar dan folder default;
- agent kustom;
- provider BYOK;
- kredensial/token YouTube, N100N, dan Telegram;
- pilihan Obsidian Vault dan catatan memori;
- usage/quota serta subscription pemiliknya.

Peran di dalam workspace:

| Peran | Gambaran hak |
| --- | --- |
| `owner` | Pemilik billing, pengelola penuh, dapat mengarsipkan workspace |
| `admin` | Mengelola member, proyek, provider, Vault, dan integrasi |
| `member` | Bekerja dengan chat/task/proyek sesuai API yang diizinkan |
| `viewer` | Membaca status/data yang memang bersifat viewer; tidak mengubah konfigurasi |

Baris lama sebelum era workspace tidak dibagikan ke semua orang. Baris tanpa
workspace hanya terlihat pada satu workspace default admin platform yang
ditandai `legacyClaim`. Workspace lain tidak boleh mengklaim data legacy
secara implisit.

Pengaturan global lama juga tidak diwariskan diam-diam. Kredensial/provider/
Vault global hanya boleh dimigrasikan secara eksplisit ke workspace legacy
pemilik platform. Workspace hosted non-legacy tidak mewarisi token YouTube,
bot Telegram, service key N100N, provider key, atau Vault pemilik server.

---

## 4. Di mana aplikasi pengguna disimpan?

PHP yang menerima request menentukan mesin penyimpanan. Ini sangat penting:

- **Instalasi lokal/desktop:** KRA berjalan di komputer pengguna sendiri,
  sehingga proyeknya juga dibuat di komputer itu.
- **Instalasi terpusat/hosted:** browser pengunjung hanya mengirim request;
  proyek dibuat di **server yang menjalankan KRA**, bukan di PC pengunjung.
  Browser tidak dapat memberi PHP akses bebas ke filesystem PC pengunjung.

Default proyek workspace non-legacy:

```text
<KRA_PROJECTS_ROOT>/KRA Workspaces/<workspace-id>/workspace-files
```

Jika `KRA_PROJECTS_ROOT` tidak diatur, KRA memakai folder induk instalasi KRA
sebagai projects root historis. Proyek tidak boleh berada di dalam repo KRA,
folder sistem, path relatif, atau path yang mengandung `..`.

Pada `KRA_DEPLOYMENT_MODE=hosted`, validasi lebih ketat: proyek harus berada
di dalam area proyek workspace-nya sendiri. Path yang sudah ada juga
di-resolve agar symlink/junction tidak dapat dipakai untuk keluar dari area
workspace.

Pemilik/admin workspace dapat mendaftarkan proyek dari **⚙ Workspace & Paket
→ Proyek workspace**. Mesin lokal admin platform masih memiliki jalur legacy
untuk folder yang sudah lama dipakai; jalur itu bukan izin bagi tenant hosted
untuk menelusuri seluruh server.

---

## 5. Memori hybrid: percakapan tidak hilang, Obsidian tetap terkurasi

KRA memakai dua lapisan memori yang berbeda fungsi.

### Lapisan 1 — memori percakapan mentah

Chat disimpan per workspace di MySQL. Jika MySQL belum tersedia pada instalasi
lokal baru, fallback JSON tetap menyimpan riwayat dengan key:

```text
<workspace-id>|<channel>
```

Lapisan ini adalah sumber kontinuitas percakapan. Agent membaca riwayat
channel/workspace aktif, bukan riwayat workspace lain.

### Lapisan 2 — pengetahuan terkurasi di Obsidian

`KraMemoryCompiler` mengubah percakapan menjadi catatan Markdown deterministik:

- maksimal 40 pesan terakhir;
- ringkasan ekstraktif;
- keputusan/preferensi/aturan;
- fakta, tanggal, target, harga, dan status;
- tugas terbuka/langkah berikut;
- tag dan frontmatter `kra_workspace`, channel, kind, serta `source_hash`;
- deduplikasi berdasarkan hash sumber;
- redaksi pola API key/token/password sebelum masuk Vault.

Tombol **Kompilasi sekarang** tersedia pada panel Workspace & Paket untuk
paket dengan `vault_manual`. Auto-compile hanya berjalan bila entitlement
memiliki `vault_auto_compile` (PLUS/PLATINUM/admin), riwayat minimal 12 pesan,
dan jumlahnya kelipatan 6.

Struktur Vault:

```text
<Vault terpilih>/
├─ Dashboard KRA Project.md                 # khusus legacy owner
└─ KRA Workspaces/
   └─ <workspace-id>/
      ├─ Dashboard KRA.md
      ├─ conversations/
      ├─ tasks/
      ├─ reports/
      └─ memory/
```

Semantic recall hanya membaca area workspace aktif dan catatan yang
frontmatter-nya tidak menunjuk workspace lain. Pada mode hosted, scan dibatasi
ke folder memori workspace. Isi catatan selalu disuntikkan sebagai **referensi**,
bukan instruksi sistem, agar teks lama/pihak ketiga tidak bisa mengambil alih
perilaku agent.

Dengan desain ini, agent tidak amnesia bila Vault belum dipilih—riwayat chat
tetap ada—sedangkan Obsidian berisi pengetahuan yang lebih bersih dan dapat
diperiksa manusia.

---

## 6. Alur pengguna dan onboarding

Setelah login SIAS:

1. KRA membuat/menemukan workspace default pengguna.
2. Header menampilkan workspace aktif dan badge paket.
3. Jika setup belum lengkap, panel onboarding membuka checklist:
   database, workspace, provider AI, Vault, proyek, dan subscription.
4. Pengguna Office dapat langsung bekerja.
5. Untuk Creator, pengguna non-admin memilih **Mulai trial PRO 7 hari** atau
   membuat permintaan checkout.
6. Pemilik/admin workspace mengatur provider BYOK/Ollama, Vault, dan proyek
   dari **⚙ Workspace & Paket**.
7. Integrasi YouTube/N100N/Telegram diatur dari panel Creator menggunakan
   kredensial workspace itu sendiri.

API key provider tidak pernah dikembalikan ke browser. Ringkasan publik hanya
mengatakan provider/model yang dipilih dan apakah key sudah ada.

---

## 7. Aktivasi manual oleh admin platform

Alur manual yang aman:

1. Pengguna login dan menekan **Minta aktivasi** pada paket.
2. KRA membuat order `pending` dengan kode publik seperti `KRA-XXXXXXXX`,
   jumlah IDR server-side, dan masa berlaku order 3 hari.
3. Pengguna membayar melalui kanal resmi di luar KRA. Jangan pernah meminta
   password SIAS, API key, client secret, atau token bot sebagai “bukti”.
4. Admin platform membuka **⚙ Workspace & Paket → Platform admin**. Order
   pending tampil di daftar; tombol **Verifikasi** mengisi kode order.
5. Setelah dana benar-benar diterima, admin menekan **Tandai order lunas**.
6. Server memperpanjang/membuat subscription dari tanggal akhir yang masih
   aktif bila ada, mencatat billing event, lalu entitlement dihitung ulang.

Admin juga dapat memberi/ubah subscription secara langsung berdasarkan user ID
SIAS, plan, dan tanggal berakhir untuk kebutuhan support.

### Environment checkout manual

| Variable | Fungsi |
| --- | --- |
| `KRA_BILLING_PAYMENT_URL` | Tautan pembayaran resmi opsional yang dimasukkan ke instruksi order |
| `KRA_BILLING_CONTACT` | Nama/kontak publik admin untuk verifikasi manual |
| `KRA_BILLING_WEBHOOK_SECRET` | Secret HMAC untuk webhook billing generik |

Jangan menaruh secret webhook di repo, screenshot, atau chat pelanggan.

### Webhook billing generik

Endpoint:

```text
POST /api/index.php?action=billing-webhook
X-KRA-Signature: sha256=<hex HMAC-SHA256(raw-body, KRA_BILLING_WEBHOOK_SECRET)>
Content-Type: application/json
```

Contoh payload pelunasan order:

```json
{
  "event_id": "evt-unik-dari-provider-001",
  "status": "paid",
  "order_code": "KRA-XXXXXXXX",
  "provider": "manual-verifier",
  "external_id": "reference-123"
}
```

`event_id` wajib unik; replay dengan ID sama tidak menerapkan pembayaran dua
kali. Adapter untuk Midtrans/Xendit/Stripe/dll. harus menerjemahkan payload
dan skema tanda tangan provider tersebut di server tepercaya—format provider
tidak boleh diteruskan mentah-mentah dengan asumsi sudah cocok.

---

## 8. Lisensi offline untuk distribusi local-first

Untuk pelanggan yang menjalankan KRA di komputernya sendiri, lisensi offline
lebih aman dan sederhana daripada membuka SaaS publik terlalu dini.

Format token:

```text
KRA1.<base64url-json>.<base64url-ed25519-signature>
```

Server pelanggan hanya memerlukan **public key**. Private key tetap di mesin
pemilik KRA dan tidak pernah didistribusikan.

### Membuat keypair (sekali, di mesin pemilik)

```powershell
php tools/license-issue.php keygen
```

Simpan `KRA_LICENSE_PRIVATE_KEY` di password manager. Masukkan
`KRA_LICENSE_PUBLIC_KEY` ke environment instalasi yang didistribusikan.

### Menerbitkan lisensi

PowerShell:

```powershell
$env:KRA_LICENSE_PRIVATE_KEY = '<secret-dari-password-manager>'
php tools/license-issue.php issue --plan=plus --period=yearly --username=budi
Remove-Item Env:KRA_LICENSE_PRIVATE_KEY
```

Bash:

```bash
KRA_LICENSE_PRIVATE_KEY='...' php tools/license-issue.php issue \
  --plan=platinum --days=366 --workspace-id=ws_xxx --seats=5
```

Binding dapat berupa user ID, username, email, dan/atau workspace ID. Tanpa
binding, token adalah lisensi instalasi lokal. Kirim hanya token hasil output
kepada pelanggan; pelanggan mengimpornya di **⚙ Workspace & Paket → Lisensi
lokal**. Jangan mengirim private key dan jangan menerima private key pelanggan.

Lisensi aktif dibaca dari penyimpanan server workspace/instalasi atau:

| Variable | Fungsi |
| --- | --- |
| `KRA_LICENSE_PUBLIC_KEY` | Public key Ed25519 base64/hex |
| `KRA_LICENSE_PUBLIC_KEY_FILE` | File berisi public key |
| `KRA_LICENSE_KEY` | Token lisensi instalasi opsional |
| `KRA_LICENSE_FILE` | File berisi token lisensi |

PHP harus memiliki extension **sodium** untuk menerbitkan/memverifikasi tanda
tangan secara nyata.

---

## 9. Konfigurasi deployment

| Variable | Nilai/fungsi |
| --- | --- |
| `KRA_DEPLOYMENT_MODE` | `local` (default) atau `hosted` |
| `KRA_PROJECTS_ROOT` | Root server tempat area `KRA Workspaces/` dibuat |
| `KRA_DB_HOST`, `KRA_DB_USER`, `KRA_DB_PASS` | Koneksi MySQL KRA |
| `KRA_MEMORY_ROOT` | Default Vault hanya untuk konteks legacy/tepercaya yang memang berhak |
| `KRA_VAULT_BROWSE_ROOT` | Batas folder Vault yang boleh dipilih tenant hosted |
| `KRA_SETTINGS_DIR` | Override folder pengaturan privat server |
| `KRA_PRIVATE_CONFIG_DIR` | Folder konfigurasi integrasi privat bila dipakai deployment |
| `KRA_PHP_BIN` | Path PHP untuk launcher Electron |
| `KRA_N100N_AUTOSTART` | `0` untuk mematikan autostart N100N desktop |

Electron menjalankan PHP lokal pada `127.0.0.1:8088` dan mengatur mode
`local` bila tidak dioverride. Ini adalah jalur distribusi yang
direkomendasikan sebelum SaaS: data, provider, proyek, YouTube, Telegram, dan
Vault berada di mesin pelanggan.

### Checklist sebelum hosted berbayar dibuka

Jangan menjual akses shared-hosted hanya karena UI terlihat selesai. Pemilik
server harus menyelesaikan dan membuktikan:

- migrasi MySQL pada database staging lalu produksi;
- backup/restore `kra_db`, pengaturan privat, Vault, dan area proyek;
- akun DB runtime bukan root dan password dikelola di luar repo;
- HTTPS publik, cookie/header/security policy, rate limit, dan log redaction;
- dua akun uji berbeda membuktikan chat/task/file/Vault/integrasi tidak bocor;
- payment gateway nyata dalam mode sandbox + webhook replay/forgery test;
- Google OAuth consent pada domain produksi dan kuota YouTube API;
- Telegram webhook HTTPS dan rotasi secret;
- proses refund, pembatalan, export data, penghapusan workspace, dan support;
- monitoring disk/kuota agar satu workspace tidak menghabiskan server.

Sampai checklist itu lulus di mesin pemilik, posisi aman adalah **local-first
licensed distribution**, bukan SaaS multi-tenant publik.

---

## 10. API komersial utama

Semua endpoint berikut berada di `api/index.php?action=...` dan, selain webhook
bertanda tangan, membutuhkan login SIAS. Browser mengirim workspace aktif
melalui header:

```text
X-KRA-Workspace: <workspace-id>
Authorization: Bearer <session-token>
```

| Action | Method | Fungsi |
| --- | :---: | --- |
| `subscription-catalog` | GET | Katalog plan server |
| `subscription-status` | GET | Entitlement + subscription pemilik workspace |
| `subscription-checkout-request` | POST | Membuat order manual pending |
| `subscription-start-trial` | POST | Trial PRO 7 hari satu kali |
| `subscription-cancel` | POST | Batalkan pada akhir periode |
| `subscription-orders` | GET | Order pengguna sendiri |
| `subscription-admin-list` | GET | Daftar subscription + order pending (platform admin) |
| `subscription-admin-upsert` | POST | Aktivasi manual oleh platform admin |
| `subscription-admin-order-paid` | POST | Verifikasi order lunas |
| `billing-webhook` | POST | Webhook HMAC generik/idempotent |
| `license-status` | GET | Status lisensi terverifikasi |
| `license-import` | POST | Impor token offline |
| `workspaces` | GET/POST | Daftar/buat workspace |
| `workspace-update` | POST | Rename/archive workspace |
| `workspace-members` | GET/POST | Daftar/tambah/hapus member |
| `projects` | GET/POST | Daftar/daftarkan proyek server |
| `project-default` | POST | Buat/pilih proyek default |
| `provider-settings` | GET/POST | Ringkasan/simpan BYOK workspace |
| `memory-compile` | POST | Kompilasi percakapan ke Obsidian |
| `memory-notes` | GET | Daftar catatan memori workspace |
| `setup-status` | GET | Checklist onboarding server-side |
| `api-keys` | GET/POST | Daftar/generate/rotate/revoke KRA API Key (sesi owner/admin; berbayar untuk generate/rotate) |
| `api-key-status` | GET | Verifikasi API key/sesi, workspace, entitlement, dan scope |

Panduan lengkap kredensial delegasi ini ada di
[`docs/KRA-API-KEYS.md`](KRA-API-KEYS.md).

Kegagalan entitlement memakai HTTP **402** dengan bentuk umum:

```json
{
  "ok": false,
  "code": "subscription_required",
  "feature": "creator_studio",
  "entitlement": { "plan": "free" },
  "catalog": []
}
```

Kegagalan role/workspace memakai 403; klien tidak boleh mengubah plan lokal
untuk “membuka” fitur.

---

## 11. Verifikasi yang tersedia

Dari root repo:

```bash
npm run verify:commercial
node --check web/app.js
node --check web/login.js
node --check desktop/main.js
```

Runtime tenant nyata melalui PHP-WASM:

```bash
cd tools/runtime-harness
npm install --ignore-scripts @php-wasm/node
VITEST=1 node run.mjs test-commercial.php
VITEST=1 node run.mjs lint.php
VITEST=1 node run.mjs
```

Test komersial mencakup harga, diferensiasi plan, trial/grace/cancel, aturan
admin SIAS, billing owner, filtering skills, binding/grace lisensi, HMAC,
visibilitas row, containment proyek hosted, isolasi chat JSON, kompilasi
Obsidian teredaksi, semantic recall antar-workspace, serta aturan berbayar,
format/hash/scope, header, dan batas delegasi KRA API Key.

Batasan yang jujur: PHP-WASM di harness tidak memiliki sodium/MySQL dan tidak
dapat menghubungi Google/Telegram/payment gateway. Tanda tangan lisensi,
migrasi MySQL, OAuth Google, Bot API, Electron GUI, dan render Concat tetap
wajib diuji di mesin pemilik dengan kredensial asli yang tidak pernah
ditempel ke chat atau repo.
