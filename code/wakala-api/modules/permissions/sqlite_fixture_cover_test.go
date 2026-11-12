package mwanachamapermissions

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const coverSpecJSON = `{
  "module": "permissions",
  "domain": "cover",
  "instance": "cov",
  "objects": [
    {"role": "role", "name": "role", "table": "roles", "description": "cover"},
    {"role": "role_action", "name": "role_action", "table": "role_actions", "description": "cover"},
    {"role": "grant", "name": "grant", "table": "grants", "description": "cover"},
    {"role": "permission", "name": "permission", "table": "permissions", "description": "cover"}
  ]
}`

const coverSpecWithoutPermissionsJSON = `{
  "module": "permissions",
  "domain": "cover",
  "instance": "cov",
  "objects": [
    {"role": "role", "name": "role", "table": "roles", "description": "cover"},
    {"role": "role_action", "name": "role_action", "table": "role_actions", "description": "cover"},
    {"role": "grant", "name": "grant", "table": "grants", "description": "cover"}
  ]
}`

func coverManager(t *testing.T, raw string) PermissionsManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	s, err := ParseSpec([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(db, s); err != nil {
		t.Fatal(err)
	}
	m, err := NewPermissionsManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return m
}
