# KRA API Key Workspace

KRA API Key adalah kredensial resmi untuk memanggil API KRA dari aplikasi,
skrip, server, atau workflow eksternal tanpa memakai token sesi login SIAS.

## Siapa yang dapat membuat key?

Key hanya dapat dibuat dan dikelola bila semua syarat berikut terpenuhi:

1. Pengguna login dengan sesi SIAS interaktif.
2. Pengguna adalah **owner/admin workspace aktif** (atau admin platform SIAS).
3. Pemilik workspace memiliki salah satu akses berbayar aktif:
   - KRA PRO;
   - KRA PLUS;
   - KRA PLATINUM; atau
   - lisensi offline berbayar yang valid dan mencakup `kra_api_access`.
4. Jumlah key aktif workspace belum mencapai batas paket.

KRA OFFICE gratis dan trial PRO gratis **tidak dapat** membuat atau memakai
KRA API Key. Admin SIAS exact (`admin`/`administrator`/`superadmin`) mengikuti
aturan bypass platform yang sudah ada.

| Paket pemilik workspace | Maksimum key aktif |
| --- | ---: |
| KRA OFFICE | 0 |
| KRA PRO | 3 |
| KRA PLUS | 10 |
| KRA PLATINUM | 25 |
| Admin SIAS | tanpa batas paket |

Paket selalu mengikuti **pemilik workspace**, bukan paket pribadi anggota yang
sedang membuka workspace tersebut. Ini sama dengan aturan entitlement Creator.

## Membuat key dari UI

1. login ke KRA.
2. Pilih workspace tujuan.
3. Buka **⚙ Workspace & Paket**.
4. Buka bagian **🔑 KRA API Key workspace**.
5. Isi nama key, masa berlaku, dan scope minimum yang dibutuhkan.
6. Klik **GENERATE KRA API KEY**.
7. Salin secret dan simpan di password manager/secret store.

Secret berbentuk `kra_live_...` dan **hanya ditampilkan sekali**. Server hanya
menyimpan hash SHA-256, prefix tampilan, empat karakter terakhir, scope, status,
masa berlaku, dan metadata pemakaian. Secret yang hilang tidak dapat dibaca
ulang; gunakan **Rotate** untuk menggantinya.

## Memakai key

Gunakan salah satu header berikut:

```http
X-KRA-API-Key: kra_live_<secret>
```

atau:

```http
Authorization: Bearer kra_live_<secret>
```

`X-API-Key` juga diterima untuk kompatibilitas klien generik.

Uji key:

```bash
curl -s \
  -H "X-KRA-API-Key: kra_live_<secret>" \
  "<BASE_KRA>/api/index.php?action=api-key-status"
```

Contoh membaca proyek pada workspace tempat key dibuat (scope `read`):

```bash
curl -s \
  -H "Authorization: Bearer kra_live_<secret>" \
  "<BASE_KRA>/api/index.php?action=projects"
```

Contoh mengirim tugas flow dari sistem eksternal (scope `workflows`; endpoint
tujuannya tetap memerlukan fitur N100N PLUS/PLATINUM/admin):

```bash
curl -s -X POST \
  -H "X-KRA-API-Key: kra_live_<secret>" \
  -H "Content-Type: application/json" \
  -d '{"judul":"Ringkasan mingguan","prompt":"Buat ringkasan status proyek minggu ini."}' \
  "<BASE_KRA>/api/index.php?action=flow-tugas"
```

Ganti `<BASE_KRA>` dengan origin instalasi KRA, misalnya
`http://127.0.0.1:8088` pada desktop lokal atau domain HTTPS pada deployment
hosted. Jangan menempel secret asli ke chat, issue, screenshot, atau repo.

## Ikatan workspace

Setiap key terikat ke **satu workspace**. Key tidak dapat dipindahkan dengan
header `X-KRA-Workspace` ke workspace lain milik pembuatnya. Jika workspace
diarsipkan, pembuat key dikeluarkan dari workspace, key di-revoke/kedaluwarsa,
atau paket pemilik workspace tidak lagi berbayar aktif, key berhenti bekerja.

Baris key tidak dihapus saat langganan berakhir. Bila workspace berlangganan
lagi sebelum key kedaluwarsa dan key belum di-revoke, key dapat bekerja lagi.
Revoke key yang sudah tidak dipercaya; jangan hanya mengandalkan berakhirnya
langganan.

## Scope

Pilih scope seminimal mungkin untuk setiap aplikasi:

| Scope | Akses utama |
| --- | --- |
| `read` | Status, setup, proyek, provider publik, agent/template/skill, riwayat chat, daftar tugas, workflow read |
| `chat` | `chat-agent`, `react-chat`, `model-propose`, `log-chat` |
| `tasks` | Membuat proposal tugas melalui `propose` |
| `workflows` | KRA workflow, `flow-*`, status/workflow/execution/run N100N |
| `memory` | Daftar/kompilasi catatan memori, Vault recall/dashboard, catatan rapat |
| `creator` | Status YouTube dan YouTube Analytics |

Scope tidak menaikkan paket. Contoh: key berscope `workflows` pada workspace
PRO tetap ditolak pada endpoint N100N yang memerlukan PLUS/PLATINUM; key
berscope `creator` tetap mengikuti entitlement Creator/YouTube workspace.

Action sensitif berikut sengaja **tidak dapat** dilakukan dengan API key dan
tetap memerlukan sesi login SIAS interaktif:

- membuat/rotate/revoke/melihat daftar API key;
- checkout, trial, pembatalan, dan administrasi billing;
- impor lisensi;
- membuat/mengarsipkan workspace dan mengelola anggota/proyek;
- mengubah provider BYOK dan kredensial YouTube/Telegram/N100N;
- menyetujui/menolak/membatalkan eksekusi tugas;
- menjalankan terminal;
- menelusuri file workspace secara bebas;
- mengunggah video ke YouTube;
- logout sesi SIAS.

API key juga tidak mewarisi hak admin platform dari pembuatnya, walaupun
dibuat oleh admin SIAS. Ia tetap kredensial delegasi yang terikat workspace
dan scope.

## Rotate dan revoke

- **Rotate** membuat secret baru dengan nama, scope, dan tanggal kedaluwarsa
  yang sama, lalu langsung me-revoke secret lama. Secret baru hanya tampil
  sekali.
- **Revoke** menonaktifkan key secara permanen. Key yang sudah di-revoke tidak
  dapat diaktifkan kembali.
- Endpoint revoke tetap dapat dipanggil oleh sesi owner/admin setelah paket
  berakhir, sehingga kredensial bocor tetap dapat dimatikan.

Praktik yang disarankan:

- satu key per aplikasi/lingkungan;
- gunakan masa berlaku 30–90 hari untuk integrasi produksi;
- rotate segera setelah pergantian staf/vendor atau dugaan kebocoran;
- simpan di secret manager, bukan file `.env` yang di-commit;
- gunakan HTTPS untuk deployment yang dapat diakses jaringan.

## Endpoint manajemen

Endpoint manajemen hanya menerima sesi SIAS owner/admin workspace, bukan API
key:

| Action | Method | Fungsi |
| --- | :---: | --- |
| `api-keys` | GET | Daftar metadata key + ringkasan kuota (tanpa secret/hash) |
| `api-keys` | POST `operation=create` | Generate key; respons memuat secret sekali |
| `api-keys` | POST `operation=rotate` | Ganti secret key aktif; secret baru tampil sekali |
| `api-keys` | POST `operation=revoke` | Nonaktifkan key |
| `api-key-status` | GET | Verifikasi sesi/API key, workspace, entitlement, dan scope |

Kode error penting:

| HTTP | `code` | Arti |
| ---: | --- | --- |
| 401 | `api_key_invalid` / autentikasi umum | Key salah, kedaluwarsa, atau sudah di-revoke |
| 402 | `paid_subscription_required` | Workspace tidak memiliki akses berbayar aktif |
| 403 | `api_key_scope_required` | Scope key tidak mencakup action |
| 403 | `api_key_action_forbidden` | Action khusus sesi interaktif |
| 403 | `workspace_forbidden` | Key/pengguna tidak berhak atas workspace tersebut |

## Perbedaan dengan machine key global

`KRA_FLOW_API_KEY`/`KRA_API_KEY` pada environment server adalah machine key
instalasi lama untuk bridge N100N tepercaya. Itu **bukan** KRA API Key
pelanggan. KRA API Key pelanggan dibuat per workspace dari UI, memiliki hash
di database, scope, masa berlaku, batas paket, rotate, dan revoke.
