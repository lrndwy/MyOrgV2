package migrations

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"backend/internal/auth"
	"backend/internal/permission"

	"github.com/lrndwy/gokil/orm"
	"github.com/lrndwy/gokil/views"
)

type Migration struct {
	ID        int64 `json:"id"`
	Name      string `json:"name"`
	Applied   bool `json:"applied"`
}

type DBVersion struct {
	ID        int64 `orm:"pk;auto" json:"id"`
	Version   int64 `orm:"unique" json:"version"`
	AppliedAt string `orm:"size:255" json:"applied_at"`
}

func (DBVersion) TableName() string {
	return "gokil_db_versions"
}

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "admin.migrations.view") // New permission
		if !ok {
			return c.Error(403, "forbidden")
		}

		migrationDir := "./migrations" // Assuming migrations are in backend/migrations

		// Read applied migrations from DB
		appliedVersions := make(map[int64]bool)
		var dbVersions []DBVersion
		if err := orm.Objects[DBVersion](c.Request.Context()).All(&dbVersions); err == nil {
			for _, v := range dbVersions {
				appliedVersions[v.Version] = true
			}
		}

		// Read migration files from directory
		var migrations []Migration
		err := filepath.Walk(migrationDir, func(path string, info fs.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() && strings.HasSuffix(info.Name(), ".sql") {
				parts := strings.SplitN(info.Name(), "_", 2)
				if len(parts) < 2 {
					return nil
				}
				versionStr := parts[0]
				version, err := strconv.ParseInt(versionStr, 10, 64)
				if err != nil {
					return nil // Skip if not a valid version number
				}

				migrations = append(migrations, Migration{
					ID:        version,
					Name:      info.Name(),
					Applied:   appliedVersions[version],
				})
			}
			return nil
		})

		if err != nil && !os.IsNotExist(err) {
			return c.Error(500, err.Error())
		}

		// Sort migrations by ID
		sort.Slice(migrations, func(i, j int) bool {
			return migrations[i].ID < migrations[j].ID
		})

		return c.Success(200, "migration status", migrations)
	})(ctx)
}
