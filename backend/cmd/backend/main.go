package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"backend"
	_ "backend/app"
	"backend/internal/response"
	"backend/internal/seed"
	"backend/internal/storageutil"
	"backend/jobs"
	_ "backend/models"
	"github.com/lrndwy/gokil/cliui"
	"github.com/lrndwy/gokil/framework"
	"github.com/lrndwy/gokil/migration"
	"github.com/lrndwy/gokil/orm"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: backend <serve|doctor|makemigrations|migrate|cron>")
	}

	switch os.Args[1] {
	case "serve":
		if err := runServe(); err != nil {
			log.Fatal(err)
		}
	case "cron":
		if err := runCron(); err != nil {
			log.Fatal(err)
		}
	case "doctor":
		if err := runDoctor(); err != nil {
			log.Fatal(err)
		}
	case "makemigrations":
		if err := runMakeMigrations(os.Args[2:]); err != nil {
			log.Fatal(err)
		}
	case "migrate":
		if err := runMigrate(os.Args[2:]); err != nil {
			log.Fatal(err)
		}
	default:
		log.Fatalf("unknown command: %s", os.Args[1])
	}
}

// storageStaticHandler melayani URL "/storage/<key>" dari disk ATAU dari
// provider storage aktif (S3).
//
// Hanya untuk kompatibilitas nilai lama di DB (era provider `local`); upload
// baru menyimpan key dan URL-nya dirakit ulang saat response:
//  1. Berkas era provider `local` masih ada di volume, jadi URL lama
//     "/storage/<key>" harus tetap jalan walau provider sekarang s3.
//  2. Kalau berkasnya tidak ada di disk, ambil dari provider aktif.
//
// Urutan: disk dulu (murah), lalu provider.
// "/storage/files" dan "/storage/folders" dikecualikan karena keduanya route
// API sungguhan (app/storage/...).
func storageStaticHandler(localPath string) func(http.Handler) http.Handler {
	fileServer := http.StripPrefix("/storage/", http.FileServer(http.Dir(localPath)))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key, ok := storageStaticKey(r.URL.Path)
			if !ok || (r.Method != http.MethodGet && r.Method != http.MethodHead) {
				next.ServeHTTP(w, r)
				return
			}
			// 1) Berkas lokal (era provider `local`).
			if _, err := os.Stat(filepath.Join(localPath, filepath.FromSlash(key))); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
			// 2) Provider aktif (S3): sajikan lewat origin aplikasi.
			if p := storageutil.Provider(); p != nil {
				if rc, err := p.Download(r.Context(), key); err == nil {
					defer rc.Close()
					writeStorageBody(w, r, key, rc)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// storageStaticKey mengubah path request menjadi key storage, atau ok=false
// kalau path itu bukan permintaan berkas (route API / traversal).
func storageStaticKey(path string) (string, bool) {
	if !strings.HasPrefix(path, "/storage/") {
		return "", false
	}
	switch path {
	case "/storage/files", "/storage/folders":
		return "", false
	}
	if strings.HasPrefix(path, "/storage/files/") {
		return "", false
	}
	key := strings.TrimPrefix(path, "/storage/")
	if key == "" || strings.Contains(key, "..") || strings.HasPrefix(key, "/") {
		return "", false
	}
	return key, true
}

func writeStorageBody(w http.ResponseWriter, r *http.Request, key string, rc io.Reader) {
	if ct := mime.TypeByExtension(filepath.Ext(key)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}
	_, _ = io.Copy(w, rc)
}

func runServe() error {
	settings, err := backend.LoadSettings()
	if err != nil {
		return err
	}

	if err := storageutil.Init(settings.Storage); err != nil {
		return fmt.Errorf("init storage: %w", err)
	}

	app, err := framework.New(settings)
	if err != nil {
		return err
	}

	// DB menyimpan key storage, bukan URL. Dua middleware ini menjaga batas
	// JSON: kolom file dinormalkan jadi key saat masuk, lalu dirakit jadi URL
	// publik (base URL provider aktif) saat keluar.
	app.Use(response.NormalizeStorageInputs)
	app.Use(response.ExpandStorageURLs)

	// Sisa URL relatif "/storage/<key>" era provider `local` di DB masih
	// dirender ke markup dan di-GET browser tanpa tanda tangan. Handler ini
	// melayaninya dari disk (settings.Storage.LocalPath, default "storage" =
	// volume /app/storage) atau dari provider aktif kalau tidak ada di disk.
	app.Use(storageStaticHandler(settings.Storage.LocalPath))

	if app.DB != nil {
		ctx := orm.WithDB(context.Background(), app.DB)
		if err := seed.SeedIfEmpty(ctx); err != nil {
			return fmt.Errorf("seed: %w", err)
		}
		if err := seed.SyncMissingPermissions(ctx); err != nil {
			return fmt.Errorf("sync permissions: %w", err)
		}
		if err := seed.SyncMissingSeedData(ctx); err != nil {
			return fmt.Errorf("sync seed data: %w", err)
		}
	}

	return app.Run(context.Background())
}

func runCron() error {
	settings, err := backend.LoadSettings()
	if err != nil {
		return err
	}
	if settings.Database.DSN == "" {
		return fmt.Errorf("GOKIL_DB_DSN is required")
	}

	sp := cliui.NewSpinner(os.Stdout)
	sp.Start("Connecting to database")
	db, err := orm.Connect(settings.Database.Driver, settings.Database.DSN, settings.Database.MaxOpenConns, settings.Database.MaxIdleConns)
	if err != nil {
		sp.Fail("Connecting to database")
		return err
	}
	defer db.Close()
	sp.Success("Connected to database")

	cliui.Infof("Cron started (Ctrl+C to stop)")
	ctx := orm.WithDB(context.Background(), db)
	return jobs.RunCron(ctx)
}

func runDoctor() error {
	settings, err := backend.LoadSettings()
	if err != nil {
		return err
	}
	return settings.Validate()
}

func runMakeMigrations(args []string) error {
	name := "auto"
	if len(args) > 0 {
		name = args[0]
	}

	sp := cliui.NewSpinner(os.Stdout)
	sp.Start("Loading settings")

	settings, err := backend.LoadSettings()
	if err != nil {
		sp.Fail("Loading settings")
		return err
	}
	if settings.Database.DSN == "" {
		return fmt.Errorf("GOKIL_DB_DSN is required")
	}
	sp.Success("Loaded settings")

	sp.Start("Connecting to database")
	db, err := orm.Connect(settings.Database.Driver, settings.Database.DSN, settings.Database.MaxOpenConns, settings.Database.MaxIdleConns)
	if err != nil {
		sp.Fail("Connecting to database")
		return err
	}
	defer db.Close()
	sp.Success("Connected to database")

	sp.Start("Detecting schema changes")
	detector := migration.Detector{DB: db.DB}
	diff, err := detector.Detect()
	if err != nil {
		sp.Fail("Detecting schema changes")
		return err
	}
	sp.Success("Detected schema changes")

	if !migration.HasChanges(diff) {
		cliui.Infof("No changes detected")
		return nil
	}

	sp.Start("Generating migration files")
	path, err := migration.Generator{Dir: settings.Database.MigrationsDir}.GenerateFromDiff(diff, name)
	if err != nil {
		sp.Fail("Generating migration files")
		return err
	}
	sp.Success(fmt.Sprintf("Created migration: %s", path))
	return nil
}

func runMigrate(args []string) error {
	rollback := false
	for _, a := range args {
		if a == "--rollback" {
			rollback = true
		}
	}

	sp := cliui.NewSpinner(os.Stdout)
	sp.Start("Loading settings")

	settings, err := backend.LoadSettings()
	if err != nil {
		sp.Fail("Loading settings")
		return err
	}
	if settings.Database.DSN == "" {
		return fmt.Errorf("GOKIL_DB_DSN is required")
	}
	sp.Success("Loaded settings")

	sp.Start("Connecting to database")
	db, err := orm.Connect(settings.Database.Driver, settings.Database.DSN, settings.Database.MaxOpenConns, settings.Database.MaxIdleConns)
	if err != nil {
		sp.Fail("Connecting to database")
		return err
	}
	defer db.Close()
	sp.Success("Connected to database")

	runner := migration.Runner{DB: db.DB, Dir: settings.Database.MigrationsDir}
	if rollback {
		sp.Start("Rolling back last migration")
		if err := runner.Rollback(); err != nil {
			sp.Fail("Rolling back last migration")
			return err
		}
		sp.Success("Rolled back last migration")
		return nil
	}

	sp.Start("Applying migrations")
	count, err := runner.Migrate()
	if err != nil {
		sp.Fail("Applying migrations")
		return err
	}
	if count == 0 {
		sp.Success("No pending migrations")
		return nil
	}
	sp.Success(fmt.Sprintf("Applied %d migration(s)", count))
	return nil
}
