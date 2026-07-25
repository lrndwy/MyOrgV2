# MyOrg System

Sistem manajemen organisasi — backend Go ([gokil](https://github.com/lrndwy/gokil)) + frontend Next.js (shadcn `base-mira`).

Dokumen: [`PRD.md`](PRD.md) · [`DESIGN.md`](DESIGN.md) · [`AGENTS.md`](AGENTS.md)

## Prasyarat

- Go 1.26+
- Node.js 20+ / pnpm
- Docker (Postgres, Redis, MinIO)
- gokil CLI opsional: `go install github.com/lrndwy/gokil/cmd/gokil@latest`  
  Backend memakai `replace` ke clone lokal `~/MyProjects/gokil` (v0.9.0 patched).

## Menjalankan (lokal)

### 1. Infrastruktur

```bash
cd backend
cp -n .env.example .env   # jika belum ada
docker compose up -d
```

### 2. Backend API

```bash
cd backend
go run ./cmd/backend migrate
go run ./cmd/backend serve
# http://127.0.0.1:8080
```

Cron status event (proses terpisah):

```bash
go run ./cmd/backend cron
```

Seed admin (saat DB kosong): `admin` / `admin123` (override `ADMIN_PASSWORD`).

### 3. Frontend

```bash
cd frontend
cp -n .env.example .env.local   # API_INTERNAL_URL=http://127.0.0.1:8080
pnpm install
pnpm dev
# http://localhost:3000
```

Browser memanggil API lewat proxy same-origin `/api/backend/*` (lihat `next.config.ts`) agar cookie `token` terbaca middleware. Setelah ubah `next.config.ts` / `.env.local`, **restart** `pnpm dev`.

## Verifikasi build

```bash
cd backend && go build ./... && go vet ./... && go test ./...
cd frontend && pnpm lint && pnpm exec tsc --noEmit && pnpm build
```

## Catatan API

Beberapa path memakai underscore (batasan package Go), bukan hyphen PRD:

- `/permission_requests`, `/permission_requests/me`
- `/attendance/permission_requests`
- `/letter_categories`, `/finance_transactions`, …

Auth: JWT di cookie httpOnly `token` + field `token` di body login.
