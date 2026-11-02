# 🚀 Panduan Instalasi & Migrasi Server Kantor-Rama-AI (KRA)

Dokumen ini berisi panduan teknis langkah demi langkah untuk memindahkan dan menjalankan Kantor-Rama-AI di komputer server baru, termasuk daftar folder/file yang wajib disalin, yang boleh diabaikan, dan konfigurasi pasca-migrasi.

---

## 1. Arsitektur Komponen yang Dibutuhkan di Komputer Server

Pastikan komputer server memiliki perangkat lunak dasar berikut:

| Komponen | Versi Minimal | Fungsi Utama | Keterangan |
| :--- | :--- | :--- | :--- |
| **PHP** | 8.4.x | Backend API (`/api`) & CLI verifikasi | Launcher Windows memakai `C:\php84\php.exe`; aktifkan `pdo_mysql`, `curl`, `json`, `mbstring`, dan `sodium` (lisensi offline) di `php.ini` |
| **MySQL / MariaDB** | 10.4+ / 8.0+ | Persistence chat, agent presence, task history | Database otomatis bernama `kra_db` |
| **Web Server** | Apache / Nginx / PHP CLI | Hosting file statis & API PHP | Standar di port 80 (Apache) atau port 8088 (PHP CLI built-in) |
| **Node.js & npm** | Node.js 22.5+ | Shell desktop (Electron) dan sub-app N100N | Gunakan runtime Node sistem atau atur `KRA_NODE_BIN` |
| **Ollama / 9Router** | Versi terbaru | Runtime LLM lokal & model fine-tuning | Default port Ollama: `11434`, 9Router: `20128` |

---

## 2. Daftar File & Folder: Apa yang Disalin vs Ditinggalkan

### ✅ DAFTAR WAJIB DISALIN KE SERVER (Source Code KRA)

Salin seluruh direktori dari `C:\xampp\htdocs\kantor-rama-ai\` ke folder web server baru (misal: `/var/www/html/kantor-rama-ai/` atau `D:\server\kantor-rama-ai\`):

```text
kantor-rama-ai/
├── agents/             # [WAJIB] Definisi archetype agen bawaan (*.agent.json)
├── api/                # [WAJIB] Core backend PHP, router, ReAct engine, DB layer
│   ├── config.example.json   # Template konfigurasi provider
│   ├── config.json           # Konfigurasi aktif (9router/ollama/simulator)
│   └── lib/                  # Seluruh engine (KraReActEngine, KraSemanticMemory, dll.)
├── assets/             # [WAJIB] Voxel 3D, atlas visual 2.5D, sound effects, sprite frames
├── desktop/            # [WAJIB] Main process & preload script untuk Electron app
├── docs/               # [WAJIB] Spesifikasi pipeline, audit, dan referensi
├── proposals/          # [OPSIONAL] Folder proposal terisolasi
├── resources/          # [WAJIB] Template Munder Difflin (36 roles) & Anti-Slop skills
├── skills/             # [WAJIB] Definisi skill lokal
├── specs/              # [WAJIB] Spesifikasi visual 2.5D & layout
├── tools/              # [WAJIB] Script verifikasi, audit-cli, penerbit lisensi khusus mesin pemilik
├── n100n/              # [WAJIB untuk PLUS] Sub-app workflow N100N
├── concat/             # [WAJIB untuk PLUS] Editor Concat yang dipakai bridge
├── web/                # [WAJIB] Frontend runtime (app.js, style.css, index.html)
├── .gitignore          # Konfigurasi ignore git
├── LICENSE             # Lisensi MIT
├── package.json        # Manifest Electron dan script npm
├── package-lock.json   # Lockfile dependency Node
└── README.md           # Deskripsi proyek
```

### 🧠 DAFTAR MEMORY VAULT OBSIDIAN (Dipindahkan Terpisah)

Kantor-Rama-AI memisahkan kode sumber dari memori kerja Obsidian. Salin folder vault memori dari `C:\vault\KRA\` ke lokasi penyimpanan di server (default tetap dicari di `C:\vault\KRA\` atau gunakan environment variable `KRA_MEMORY_ROOT`):

```text
C:\vault\KRA\
├── Dashboard KRA Project.md   # [KRUSIAL] Master index proyek & milestone log
├── KRA.md                     # Aturan operasional Jarvis & boundary keselamatan
├── PROJECT LOCATION.md        # Catatan lokasi workspace
├── agents/                    # Catatan dossier agen
├── reports/                   # Seluruh laporan audit, meeting, dan verifikasi
├── specs/                     # Catatan spesifikasi teknis
└── KRA Workspaces/             # Dibuat per workspace non-legacy oleh Memory Compiler
    └── <workspace-id>/         # Dashboard, conversations, tasks, reports, memory
```

---

### ❌ JANGAN DISALIN (Abaikan / Tinggalkan)

Hemat ukuran transfer dan hindari file korup dengan **TIDAK MENYALIN** folder berikut:

1. **`node_modules/` (~278 MB)**:  
   *Alasan:* Dibuat ulang secara bersih di komputer server dengan menjalankan `npm install`.
2. **`.temp/`**:  
   *Alasan:* Berisi cache runtime temporer (`tasks.json`, `workflows.json`) yang akan di-generate ulang otomatis.
3. **File backup OS**:  
   `Thumbs.db`, `.DS_Store`, log temporer.
4. **Rahasia instalasi pemilik saat membuat paket untuk pelanggan lain**:
   Jangan distribusikan `.temp/private-settings/`, token YouTube/Telegram,
   API key provider, `n100n/.env`, private key lisensi, atau salinan Vault
   pribadi. Buat ulang kredensial pada mesin pelanggan dan simpan private key
   lisensi hanya di password manager pemilik KRA.

---

## 3. Langkah Demi Langkah Instalasi di Server Baru

### Langkah 1: Penempatan Direktori

Letakkan file di root web server Anda:
- **Windows (XAMPP):** `\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\`
- **Linux (Apache/Nginx):** `/var/www/html/kantor-rama-ai/`

Set environment variable (jika letak vault tidak di `C:\vault\KRA`):
```bash
# Windows PowerShell
[System.Environment]::SetEnvironmentVariable('KRA_MEMORY_ROOT', 'C:\vault\KRA', 'Machine')

# Linux
export KRA_MEMORY_ROOT="/data/vault/KRA"
```

### Langkah 2: Setup Database MySQL

1. Pastikan service MySQL/MariaDB menyala di port 3306.
2. Untuk penggunaan serius, buat akun MySQL khusus KRA dengan hak minimum dan atur environment variable proses PHP:
   ```env
   KRA_DB_HOST=127.0.0.1
   KRA_DB_USER=kra_user
   KRA_DB_PASS=<password-kuat>
   ```
   Akun `root` tanpa password hanya dipakai otomatis oleh PHP built-in server yang terikat ke loopback untuk development lokal. Jangan expose server development ke LAN. `KRA_ALLOW_DEFAULT_DB_ROOT=1` hanya untuk override eksplisit pada request loopback.
3. KRA saat ini menjalankan **Auto-Migration** ketika API tersambung; database `kra_db` beserta tabel aplikasi dibuat bila belum tersedia. Untuk deployment produksi, gunakan akun migrasi terpisah dan kurangi hak akun runtime setelah schema dibuat.

### Langkah 3: Install Dependensi Desktop (Jika Memakai GUI Electron)

Buka terminal di folder project `kantor-rama-ai/`:
```bash
npm install
```

### Langkah 4: Konfigurasi AI Provider (`api/config.json`)

Pastikan file `api/config.json` siap digunakan. Jika memakai Ollama lokal di server:
```json
{
  "defaultProvider": "ollama",
  "providers": {
    "ollama": {
      "baseUrl": "http://127.0.0.1:11434/v1",
      "model": "llama3.2",
      "apiKeyEnv": "",
      "healthUrl": "http://127.0.0.1:11434/v1/models",
      "modelsUrl": "http://127.0.0.1:11434/v1/models",
      "fallbackProvider": "simulator"
    },
    "simulator": {
      "baseUrl": "local",
      "model": "kra-simulator-v1",
      "apiKeyEnv": "",
      "fallbackProvider": "simulator"
    }
  }
}
```

---

## 3A. Setup Multiuser, Workspace & Paket Creator

Panduan bisnis/arsitektur lengkap ada di
[`docs/COMMERCIAL-AND-WORKSPACES.md`](docs/COMMERCIAL-AND-WORKSPACES.md).
Ringkasnya:

1. Biarkan request API pertama menjalankan auto-migration tabel workspace,
   subscription, order, proyek, usage, dan memory notes. Backup database
   sebelum upgrade produksi.
2. Login memakai akun SIAS. Hanya role persis `admin`, `administrator`,
   `superadmin`, atau `super admin` yang otomatis membuka Creator setara
   PLATINUM. Pengguna lain memakai trial/PRO/PLUS/PLATINUM milik **pemilik
   workspace** atau lisensi offline.
3. Buka **⚙ Workspace & Paket**. Lengkapi checklist provider BYOK/Ollama,
   Vault, dan proyek. API key disimpan server-side per workspace dan tidak
   ditampilkan kembali.
4. Atur area proyek terpusat bila perlu:

   ```powershell
   [System.Environment]::SetEnvironmentVariable('KRA_PROJECTS_ROOT', 'D:\KRA-Projects', 'Machine')
   [System.Environment]::SetEnvironmentVariable('KRA_DEPLOYMENT_MODE', 'local', 'Machine')
   ```

   Mode `hosted` memaksa setiap proyek tetap di
   `KRA Workspaces\<workspace-id>\` pada server; proyek tidak pernah dibuat
   di PC browser pengunjung.
5. Untuk checkout manual, atur kontak/tautan pembayaran resmi pada proses
   PHP: `KRA_BILLING_CONTACT`, `KRA_BILLING_PAYMENT_URL`, dan secret webhook
   `KRA_BILLING_WEBHOOK_SECRET`. Admin memverifikasi order pending dari panel
   Platform admin setelah dana diterima.
6. Untuk distribusi lokal berlisensi, buat keypair **hanya di mesin pemilik**:

   ```powershell
   php tools/license-issue.php keygen
   $env:KRA_LICENSE_PRIVATE_KEY = '<simpan-di-password-manager>'
   php tools/license-issue.php issue --plan=plus --period=yearly --username=<username-sias>
   Remove-Item Env:KRA_LICENSE_PRIVATE_KEY
   ```

   Instalasi pelanggan hanya menerima `KRA_LICENSE_PUBLIC_KEY` dan token
   hasil penerbitan. Jangan pernah mengirim/menyimpan private key di repo.

Jangan membuka SaaS hosted berbayar sebelum checklist keamanan, backup,
payment sandbox, dan uji dua tenant pada dokumen komersial lulus di server
pemilik. Jalur yang direkomendasikan saat ini adalah instalasi lokal/desktop
berlisensi.

---

## 4. Uji Coba & Verifikasi Pasca-Migrasi

Jalankan serangkaian script pengujian bawaan di terminal server untuk memastikan semua komponen berfungsi sempurna:

### 1. Jalankan Audit Kepatuhan & Keamanan Kode
```bash
php tools/audit-cli.php
```
*Hasil yang diharapkan:* `VERDICT: APPROVED (FINDINGS: 0, SECRETS: 0)`.

### 2. Jalankan Uji Coba RAG & Autonomous Workflow (Phases 10–14)
```bash
php tools/verify-phase10-14.php
```
*Hasil yang diharapkan:* Semua checklist Phase 10 hingga 14 bertanda `[PASS]`.

### 3. Jalankan Uji Coba Multi-Agent ReAct Engine (Phase 9 & Phase 8B)
```bash
php tools/verify-phase9.php
php tools/verify-phase8b.php
```
*Hasil yang diharapkan:* `PHASE 9 VERIFICATION PASSED` dan `PHASE 8B VERIFICATION PASSED`.

### 4. Verifikasi Workspace, Paket & Memori
```bash
npm run verify:commercial
cd tools/runtime-harness
VITEST=1 node run.mjs test-commercial.php
cd ../..
```
*Hasil yang diharapkan:* verifier statis lulus dan ringkasan runtime memuat
`COMMERCIAL_TENANT_TESTS=PASS`. Pemeriksaan tanda tangan Ed25519 dapat
berstatus SKIP pada PHP-WASM tanpa sodium; jalankan issuer lisensi pada PHP
pemilik untuk bukti kriptografis nyata.

### 5. Menjalankan Aplikasi
- **Aplikasi Web via Browser:**
  Buka: `http://100.76.172.67:8088/web/index.html` (dari server: `http://127.0.0.1:8088/web/index.html`)
- **Aplikasi Desktop Mandiri:**
  ```bash
  npm start
  ```

---

## 6. Menjalankan Fine-Tuning Model Lokal di Server

Setelah server menyala dan KRA beroperasi:
1. Generate dataset instruksi dari histori kantor:
   ```bash
   php tools/prepare-finetune.php
   ```
2. File dataset akan tersimpan di `.temp/kra_finetune_dataset.jsonl`.
3. Jalankan script pelatihan PyTorch/Unsloth sesuai panduan di:  
   `C:\vault\KRA\reports\2026-10-25 - Local GPU Fine-Tuning and Migration Script.md`
4. Muat model hasil training ke Ollama lokal dengan nama `kantor-rama-ai`.
