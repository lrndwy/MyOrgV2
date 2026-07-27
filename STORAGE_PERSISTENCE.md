# Storage Data Loss Fix — Production Deployment

## Masalah

Ketika Dokploy melakukan rebuild dan redeploy, semua file yang diupload (avatar, banner, lampiran, dll) hilang. Ini terjadi karena:

1. **Storage disimpan di dalam container** — File disimpan di `/app/storage` atau `/data/storage` di dalam container
2. **Container di-rebuild tanpa volume** — Saat rebuild, container lama dihapus dan yang baru dibuat, tapi data di dalamnya hilang
3. **Volume tidak persist** — `docker-compose.prod.yml` tidak mendefinisikan volume untuk service backend

## Solusi

### Quick Fix (Sudah Diterapkan)

Tambahkan volume `gokil_storage` ke backend service di kedua file compose:

**`docker-compose.prod.yml`:**
```yaml
gokil:
  volumes:
    - gokil_storage:/app/storage
```

**`backend/docker-compose.prod.yml`:**
```yaml
gokil:
  volumes:
    - gokil_storage:/app/storage

volumes:
  gokil_storage:
```

Dengan ini, data akan persist di Docker volume yang tidak dihapus saat rebuild.

---

## Rekomendasi untuk Production

### ✅ Option 1: Local Storage dengan Volume (Saat ini)

**Kelebihan:**
- Sederhana, tidak perlu service eksternal
- Cocok untuk single-server deployment

**Kekurangan:**
- Data hanya ada di satu server (tidak HA)
- Jika server rusak, data hilang

**Setup:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
# Data akan tersimpan di Docker volume, persist across rebuilds
```

---

### ⭐ Option 2: MinIO (S3-Compatible) — RECOMMENDED

**Kelebihan:**
- Data tersentralisasi, independen dari container lifecycle
- Mudah di-backup dan di-migrate
- Support multi-server/HA setup
- Auto-scaling friendly

**Setup:**

1. **Uncomment MinIO di `docker-compose.prod.yml`:**
   ```yaml
   minio:
     image: minio/minio:latest
     restart: unless-stopped
     environment:
       MINIO_ROOT_USER: ${GOKIL_STORAGE_ACCESS_KEY_ID}
       MINIO_ROOT_PASSWORD: ${GOKIL_STORAGE_SECRET_ACCESS_KEY}
     command: server /data --console-address ":9001"
     volumes:
       - minio_data:/data
     networks:
       - internal
   ```

2. **Update `.env` (atau `.env.prod`):**
   ```bash
   GOKIL_STORAGE_PROVIDER=s3
   GOKIL_STORAGE_ENDPOINT=minio:9000
   GOKIL_STORAGE_BUCKET=myorg
   GOKIL_STORAGE_ACCESS_KEY_ID=admin
   GOKIL_STORAGE_SECRET_ACCESS_KEY=your_secure_password
   GOKIL_STORAGE_REGION=us-east-1
   GOKIL_STORAGE_USE_SSL=false
   GOKIL_STORAGE_BASE_URL=https://storage.yourdomain.com
   ```

3. **Deploy:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

---

## Checklist untuk Production

- [ ] Volume `gokil_storage` ditambahkan ke backend service
- [ ] Volume definition ada di `volumes:` section
- [ ] `.env.prod` sudah di-set dengan STORAGE_PROVIDER yang benar
- [ ] Jika pakai MinIO: bucket sudah dibuat, credentials valid
- [ ] Jika pakai local storage: pastikan host memiliki disk space cukup
- [ ] Backup strategy sudah ada (jika local: regular volume backup; jika MinIO: MinIO backup)

---

## Testing

Setelah deploy:

1. Upload file di admin panel (avatar, template, lampiran, dll)
2. Rebuild container: `docker compose -f docker-compose.prod.yml up -d --build`
3. Verifikasi file masih ada
4. Check volume: `docker volume ls | grep gokil`

---

## Rollback

Jika ada masalah:

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect gokil_storage

# Manual backup
docker run --rm -v gokil_storage:/data -v $(pwd):/backup alpine tar czf /backup/gokil-storage-backup.tar.gz -C /data .
```
