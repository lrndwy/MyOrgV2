# CLAUDE.md — MyOrganizations System

Instruksi khusus untuk Claude Code saat bekerja di proyek ini. Aturan umum lintas-agent ada di [`AGENTS.md`](AGENTS.md); arsitektur ada di [`DESIGN.md`](DESIGN.md); requirement produk ada di [`PRD.md`](PRD.md).

**Baca ketiga dokumen tersebut sebelum mengerjakan task apa pun.**

Stack cepat: **backend/** = Go + [gokil](https://github.com/lrndwy/gokil); **frontend/** = Next.js + shadcn `base-mira`; DB/Redis/MinIO via Docker Compose.

## 1. Cara Memulai Setiap Sesi

1. Baca `PRD.md` untuk fitur yang relevan dengan task.
2. Baca `DESIGN.md` §0 (stack & batasan gokil), §2 (entity), §5–§6 (permission & business logic) yang terkait.
3. Periksa route terdaftar di [`backend/app/register.go`](backend/app/register.go) sebelum menambah endpoint (hindari duplikat).
4. Jika menyentuh model: baca dulu [`backend/models/models.go`](backend/models/models.go) (dan file model terkait) — jangan asumsikan field dari ingatan.
5. Frontend: cek route group di `frontend/app/` dan komponen shadcn yang sudah ada di `frontend/components/` sebelum menambah UI baru.

## 2. Operasi Aman vs Destruktif

**Aman (read-only / verifikasi)** — boleh tanpa konfirmasi tambahan:
```bash
# backend/
gokil generateroutes          # hanya menulis register.go generated
go build ./... && go vet ./... && go test ./...
go run ./cmd/backend doctor
# frontend/
pnpm lint && pnpm exec tsc --noEmit && pnpm build
# git
git status && git diff && git log
# docker status
docker compose -f backend/docker-compose.yml ps
```

**Destruktif / mengubah state** — konfirmasi pengguna dulu, atau jelaskan efeknya sebelum eksekusi:
```bash
docker compose -f backend/docker-compose.yml down -v   # hapus volume DB/Redis/MinIO
go run ./cmd/backend migrate --rollback
go run ./cmd/backend makemigrations ... && migrate      # ubah skema
# hapus modul/route yang sudah ter-wire
# deploy production / maintenance mode
```

Jangan jalankan operasi destruktif terhadap environment production (cek `GOKIL_ENV` / host sebelum eksekusi).

Patch ke framework gokil dilakukan di repo terpisah (`~/MyProjects/gokil` / <https://github.com/lrndwy/gokil.git>) — minta konfirmasi eksplisit sebelum mengubah repo itu dari sesi MyOrg.

## 3. Alur Kerja Standar: Tambah Fitur Baru

1. Cek `DESIGN.md` §2 — entity sudah dipetakan? Jika belum, update `DESIGN.md` dulu.
2. Backend: model → migration → `services/` → `app/<path>/route.go` → `gokil generateroutes`.
3. Business logic non-trivial di **service**, bukan handler.
4. Permission baru → seed (`DESIGN.md` §5 / §7).
5. UI di `frontend/app/(member)` dan/atau `(admin)` sesuai sitemap PRD §6; komponen via `npx shadcn@latest add`.
6. Verifikasi (`AGENTS.md` §5) sebelum melaporkan selesai.

## 4. Batasan & Dokumentasi

- `PRD.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md` adalah **living document** — update jika ada keputusan desain baru.
- Jangan commit `.env`, `node_modules/`, artifact build, atau secret.
- `app/register.go` adalah generated — regenerate, jangan edit manual kecuali darurat.
- Jangan hapus marker/konvensi generator tanpa memahami efeknya.
- UI: hanya shadcn preset `base-mira` — jangan menambah design system lain.

## 5. Definition of Done

Sebelum menyatakan task selesai:
- [ ] `go build` / `go vet` / `go test` backend lulus
- [ ] `pnpm lint` / `tsc` / `pnpm build` frontend lulus (jika ada perubahan UI)
- [ ] Endpoint baru ada di `register.go` + permission check terpasang
- [ ] Perubahan skema/desain penting ada di `DESIGN.md`
- [ ] Upload memakai object storage + URL, bukan base64 di DB
- [ ] Tidak memakai `models.*` facade; akses DB via `orm.*` + request context

Jika salah satu gagal dan tidak bisa diperbaiki dalam sesi ini, laporkan secara eksplisit.

## 6. Gaya Komunikasi ke Pengguna

- Ringkas: sebutkan fitur/resource, file kunci, hasil verifikasi.
- Penyimpangan dari `DESIGN.md` → sebutkan sebagai keputusan eksplisit.
- Requirement PRD ambigu → jelaskan trade-off; jangan menyederhanakan diam-diam.
- Bahasa: ikuti preferensi pengguna (default komunikasi sesi: Jepang bila diminta di user rules).

## 7. Hal yang Sering Salah (Hindari)

- Business logic (approval, counter surat, cron status event) di handler, bukan service.
- Gate fitur dengan role string `"Admin"` alih-alih permission code.
- Upload (selfie, signature, lampiran) sebagai base64 di kolom DB.
- Lupa update `DESIGN.md` setelah field/entity baru.
- Endpoint sensitif tanpa permission check.
- Lupa `gokil generateroutes` setelah menambah `route.go`.
- Memakai `models.Query/Create/Save/Delete` (race concurrent).
- Mengandalkan `orm.WithTx` sebelum patch (tidak atomik di v0.8.1).
- `models.Save` pada objek baru → UPDATE `WHERE id = 0`.
- Hardcode warna / UI non-shadcn.
- Mengikuti docs gokil yang menyebut API belum ada (`views.List`, dll.).

## 8. Jebakan gokil (checklist cepat)

| Jebakan | Yang benar |
|---|---|
| Route baru tidak muncul | `gokil generateroutes` lalu restart serve |
| `models.*` di handler | Ganti ke `orm.Objects/Create/UpdateByID` + `ctx.Request.Context()` |
| Approval/counter butuh atomisitas | `BeginTx` + raw SQL + `FOR UPDATE` (lihat DESIGN §6.2–§6.3) |
| `Save()` instance baru | Pakai `orm.Create` |
| `/me` tertangkap `:id` | Pastikan route statis terdaftar sebelum dinamis |
| `ctx.DB()` | Jangan dipakai; pakai `orm.DBFromContext(request.Context())` |
| Envelope `{"error":...}` | Wrapper proyek `success`/`message`/`errors` (PRD §5.0) |
| Cron error hilang | Set `Logger` / `OnError` pada job runner |
| Docs gokil vs source | Percaya source + dokumen proyek ini |

Roadmap fase: `DESIGN.md` §13 (Fase 0 patch gokil → Fase 6 surat & notifikasi).
