# Concat di dalam KRA — catatan snapshot (KRA)

Folder ini adalah **snapshot source** dari project video editor open-source
**Concat** (pengganti CapCut, lokal & gratis), disalin utuh ke repo
kantor-rama-ai agar perjalanan integrasinya satu pintu dengan KRA,
mengikuti pola yang sama dengan `n100n/UPSTREAM.md`.

- Upstream: https://github.com/jub0t/Concat
- Snapshot commit: `f0c0169628c61de7311f7fc15ee5be82dd611d2e` (branch `main`)
- Diimpor: 2026-11-01
- Lisensi: **AGPL-3.0-or-later** (lihat `LICENSE` di folder ini — jangan dihapus)

## Cara KRA terhubung (penting, terkait lisensi)

KRA **tidak menautkan (link) kode Concat** ke dalam PHP/JS KRA. Concat tetap
**proses terpisah** yang digerakkan lewat antarmuka mesin resminya:

```
KRA (PHP) ──► n100n workflow ──► HTTP ──► tools/kra-concat-bridge ──► stdio MCP ──► concat --mcp (headless)
```

- Dokumen integrasi: `docs/CONCAT-INTEGRATION.md` di root KRA.
- Contoh workflow: `n100n/workflows/contoh-concat-edit.json`.
- Snapshot source di sini dipakai untuk: referensi API/MCP, dan opsi
  build-from-source. Untuk pemakaian harian, upstream menyarankan binary
  rilis resmi (https://github.com/jub0t/Concat/releases); bridge KRA cukup
  diarahkan ke binary tersebut lewat env `CONCAT_BIN`.

## Memperbarui snapshot

Bandingkan repo upstream, lalu salin ulang source baru secara sengaja.
Jangan menyalin `.git/`, folder `target/` (hasil build Rust), atau data
runtime pengguna Concat (project, exports, config di folder home pengguna).
Catat commit baru di file ini.

Kewajiban AGPL berlaku pada Concat itu sendiri: bila Anda memodifikasi
Concat dan menyebarkannya (termasuk menyediakannya lewat jaringan), source
modifikasinya wajib dibuka dengan lisensi yang sama. Pemakaian sebagai
proses lokal terpisah lewat MCP tidak mengubah lisensi kode KRA.
