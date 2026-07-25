# AGENTS.md — MyOrganizations System

Panduan ini untuk **AI coding agent** apa pun yang mengerjakan proyek ini. Baca file ini penuh sebelum membuat perubahan.

| Dokumen | Isi |
|---|---|
| [`PRD.md`](PRD.md) | Requirement produk: alur fitur, input/output, schema, endpoint, sitemap |
| [`DESIGN.md`](DESIGN.md) | Stack, arsitektur, entity mapping, batasan gokil, permission, storage, roadmap |
| [`AGENTS.md`](AGENTS.md) | Panduan umum agent (dokumen ini) |
| [`CLAUDE.md`](CLAUDE.md) | Instruksi khusus Claude Code |

## 1. Ringkasan Project

MyOrg System adalah aplikasi manajemen organisasi: user, role & access, divisi, event, absensi, perizinan, pelanggaran/SP, open recruitment, surat masuk/keluar, announcement, keuangan, dan penyimpanan file organisasi.

- **Backend:** Go + [gokil](https://github.com/lrndwy/gokil) di [`backend/`](backend/)
- **Frontend:** Next.js + shadcn/ui preset `base-mira` di [`frontend/`](frontend/)
- **Infra lokal:** Postgres + Redis + MinIO via `backend/docker-compose.yml`

Referensi requirement lengkap: `PRD.md`. Keputusan teknis: `DESIGN.md`.

## 2. Struktur Project (nyata)

```
MyOrg-v2/
  backend/                 # API gokil
    app/                   # file-based routes (*route.go → register.go generated)
    cmd/backend/main.go    # serve | cron | doctor | makemigrations | migrate
    models/                # orm models (embed orm.BaseModel, int64 PK)
    services/              # business logic (target)
    internal/              # auth, permission, response, storage wiring (target)
    jobs/cron.go
    migrations/
    settings.go
    docker-compose.yml
  frontend/                # Next.js App Router
    app/(auth)/            # login, register, recruitment publik
    app/(member)/          # dashboard anggota
    app/(admin)/admin/     # panel operasional
    components/            # shadcn + app shell
    lib/
  PRD.md
  DESIGN.md
  AGENTS.md
  CLAUDE.md
```

Modul domain backend: **model → service → route handler**. Handler hanya bind input, cek permission, panggil service, tulis response.

## 3. Alur Kerja: Tambah Fitur Baru

1. Baca `PRD.md` untuk fitur yang relevan.
2. Cek `DESIGN.md` §2 — entity sudah dipetakan? Jika belum, **update DESIGN.md dulu**.
3. Backend: model + migration → service → `app/<resource>/route.go` (+ `_id/route.go`) → `gokil generateroutes` → permission check.
4. Permission baru → seed (`DESIGN.md` §5 / §7).
5. Frontend: halaman di route group yang sesuai; komponen UI hanya dari shadcn (`base-mira`).
6. Jalankan verifikasi (§5) sebelum melaporkan selesai.

## 4. Konvensi Kode

### Backend (gokil)

- **Framework:** [gokil](https://github.com/lrndwy/gokil) — file-based routing. File `app/**/route.go` mengekspor `GET` / `POST` / `PUT` / `PATCH` / `DELETE`. Folder `_id` → path `:id`.
- Setelah menambah/mengubah route: jalankan **`gokil generateroutes`** (memperbarui `app/register.go`). `go run ./cmd/backend serve` **tidak** regenerate otomatis.
- **PK:** `int64` via `orm.BaseModel` — jangan pakai UUID sebagai PK.
- **Larang** `models.Query` / `models.Create` / `models.Save` / `models.Delete` (race di gokil ≤0.8.1). Pakai:
  - `orm.Objects[T](ctx.Request.Context())`
  - `orm.Create(ctx, &obj)`
  - `orm.UpdateByID[T](ctx, id, map[string]any{...})`
- Transaksi kritis (approval izin, counter surat): `*sql.Tx` + raw SQL (+ `FOR UPDATE`) sampai `orm.WithTx` di-patch (lihat `DESIGN.md` §0.1).
- Permission: panggil helper `RequirePermission` di **awal** setiap handler sensitif — jangan hardcode role string `"Admin"`.
- Response: envelope proyek `{ "success", "message", "data"|"errors" }` (PRD §5.0), bukan envelope mentah gokil.
- Upload: MinIO via `storage.Provider`; simpan **URL** di DB — jangan base64.
- Composite unique / index khusus: SQL manual di `migrations/`.
- Path statis (`/users/me`) harus terdaftar sebelum dinamis (`/users/:id`) — urutan router linear.

### Frontend (Next.js + shadcn)

- Semua UI memakai **shadcn/ui** preset **`base-mira`** (sudah di `components.json`). Tambah komponen: `npx shadcn@latest add <name>`.
- Styling hanya lewat token CSS (`bg-primary`, `text-muted-foreground`, `--chart-1..5`, sidebar tokens). **Jangan** hardcode warna hex/oklch di luar `globals.css`.
- Blok fondasi: login-02, signup-02, sidebar-08 — extend, jangan ganti design system.
- Route groups: `(auth)`, `(member)`, `(admin)` — lihat PRD §6.
- Validasi form selaras schema backend (zod / shared types bila ada).
- API client terpusat di `lib/` — jangan duplikasi fetch di setiap page.
- Auth: andalkan cookie httpOnly `token` dari backend; Server Components boleh proxy request dengan cookie.

### Permission & Role

- Gate fitur dengan **permission code** (`events.create`, …).
- System admin role terpisah untuk tooling (backup, dsb.).
- Sidebar admin/member filter dari `GET /me/permissions`.

### File Upload

- Object storage (MinIO/S3) + URL di DB.
- Validasi MIME & ukuran di service backend.

## 5. Testing & Verifikasi

Sebelum menganggap task selesai:

**Backend** (dari `backend/`):
```bash
gokil generateroutes          # jika ada perubahan route
go build ./...
go vet ./...
go test ./...
# opsional: go run ./cmd/backend doctor
```

**Frontend** (dari `frontend/`):
```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Checklist:
1. Test/lint backend lulus.
2. Lint/typecheck/build frontend lulus (jika ada perubahan UI).
3. Endpoint baru terdaftar di `app/register.go` dan terproteksi permission yang benar.
4. Perubahan skema/desain penting sudah di `DESIGN.md`.
5. Upload memakai storage URL, bukan base64.

Tulis test minimal untuk service: approval perizinan, generate kode surat, counter surat, import user.

## 6. Environment & Secret

Jangan commit `.env` berisi secret. Agent tidak menulis secret baru ke file yang di-commit.

**Gokil / app (lihat `backend/.env.example`):**
- `GOKIL_APP_NAME`, `GOKIL_ENV`, `GOKIL_DEBUG`, `GOKIL_HOST`, `GOKIL_PORT`
- `GOKIL_DB_DRIVER`, `GOKIL_DB_DSN`, `GOKIL_DB_MIGRATIONS_DIR`, …
- `GOKIL_REDIS_*`
- `GOKIL_STORAGE_PROVIDER=s3`, `GOKIL_STORAGE_ENDPOINT`, `GOKIL_STORAGE_BUCKET`, `GOKIL_STORAGE_ACCESS_KEY_ID`, `GOKIL_STORAGE_SECRET_ACCESS_KEY`, `GOKIL_STORAGE_REGION`, `GOKIL_STORAGE_USE_SSL`, `GOKIL_STORAGE_BASE_URL`

**Tambahan proyek (target):**
- `JWT_SECRET` (atau nama env yang dipilih di implementasi auth)
- `ADMIN_DEFAULT_PASSWORD` (seed production)
- SMTP / email (notifikasi)
- Frontend: `NEXT_PUBLIC_API_URL`

Infra lokal: `docker compose -f backend/docker-compose.yml up -d` (Postgres, Redis, MinIO setelah ditambahkan).

## 7. Git & Commit Convention

- Message: `<type>(<scope>): <deskripsi singkat>` — `feat`, `fix`, `chore`, `refactor`, `docs`, `test`.
- Scope = modul, mis. `feat(events): tambah endpoint recap absensi`.
- Satu resource/feature per PR sebisa mungkin.
- Jangan commit artifact build, `.env`, `node_modules/`, `storage/` lokal.

Patch framework gokil dilakukan di repo terpisah (<https://github.com/lrndwy/gokil.git>), bukan di commit monolit MyOrg kecuali bump `go.mod`.

## 8. Do's & Don'ts

**Do:**
- Baca `PRD.md` + `DESIGN.md` sebelum fitur baru.
- Business logic di `services/`.
- Update dokumentasi jika ada keputusan desain baru.
- Ikuti `DESIGN.md` §0.1 untuk batasan gokil.

**Don't:**
- Jangan pakai `models.*` facade scaffold.
- Jangan hardcode role `"Admin"` untuk gate bisnis.
- Jangan hardcode URL/secret/bucket di source.
- Jangan menyederhanakan requirement PRD diam-diam.
- Jangan menambah UI kit / palette di luar shadcn `base-mira`.
- Jangan mengandalkan docs gokil yang menyebut API tidak ada di versi terpasang — verifikasi source.
