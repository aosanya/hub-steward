package main

import (
	"os"

	"gorm.io/gorm"

	"wakalaserver/internal/accounts"
)

func limitModulePool(db *gorm.DB) {
	if sqlDB, err := db.DB(); err == nil {
		accounts.PoolFromEnv("WAKALA_MODULE_DB", accounts.ModulePool, os.Getenv).Apply(sqlDB)
	}
}
