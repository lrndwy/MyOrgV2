package migrations

import (
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
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Applied bool   `json:"applied"`
}

type DBVersion struct {
	ID        int64  `orm:"pk;auto" json:"id"`
	Version   int64  `orm:"unique" json:"version"`
	AppliedAt string `orm:"size:255" json:"applied_at"`
}

func (DBVersion) TableName() string {
	return "gokil_db_versions"
}

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "admin.migrations.view")
		if !ok {
			return c.Error(403, "forbidden")
		}

		migrationDir := "./migrations"

		appliedVersions := make(map[int64]bool)
		all, err := orm.Objects[DBVersion](c.Request.Context()).All()
		if err == nil {
			for _, v := range all {
				appliedVersions[v.Version] = true
			}
		}

		var migrations []Migration
		err = filepath.Walk(migrationDir, func(path string, info fs.FileInfo, err error) error {
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
					return nil
				}
				migrations = append(migrations, Migration{
					ID:      version,
					Name:    info.Name(),
					Applied: appliedVersions[version],
				})
			}
			return nil
		})

		if err != nil && !os.IsNotExist(err) {
			return c.Error(500, err.Error())
		}

		sort.Slice(migrations, func(i, j int) bool {
			return migrations[i].ID < migrations[j].ID
		})

		return c.Success(200, "migration status", migrations)
	})(ctx)
}
