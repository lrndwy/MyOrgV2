package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"backend"
	_ "backend/app"
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

	// Local storage provider writes files to disk but the framework's router
	// only matches fixed-arity paths, so uploaded files (logo, banner, selfie,
	// etc.) need an explicit static file handler for the "/storage/" URLs
	// returned by storageutil.Upload. S3/MinIO already returns absolute URLs
	// served by the object storage itself, so this only applies to "local".
	// "/storage/folders" is excluded because it's a real API route (app/storage/folders).
	if strings.EqualFold(settings.Storage.Provider, "local") {
		fileServer := http.StripPrefix("/storage/", http.FileServer(http.Dir(settings.Storage.LocalPath)))
		app.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				isStaticFile := r.Method == http.MethodGet &&
					strings.HasPrefix(r.URL.Path, "/storage/") &&
					r.URL.Path != "/storage/folders" &&
					r.URL.Path != "/storage/files" &&
					!strings.HasPrefix(r.URL.Path, "/storage/files/")
				if isStaticFile {
					fileServer.ServeHTTP(w, r)
					return
				}
				next.ServeHTTP(w, r)
			})
		})
	}

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
