package main

import (
	"log/slog"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	workspace "wakalaserver/modules/workspace"
)

type mountedWorkspace struct {
	manager workspace.WorkspaceManager
	layouts workspace.LayoutManager
}

var workspaceMount = specMount{
	module: "workspace",
	prefix: "WORKSPACE",
	load:   workspace.LoadSpec,
	parse:  workspace.ParseSpec,
}

func buildWorkspace(log *slog.Logger) mountedWorkspace {
	dsn := os.Getenv("WORKSPACE_DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" || !workspaceMount.configured() {
		log.Info("no workspace mounted",
			"reason", "both WORKSPACE_INSTANCE and WORKSPACE_SPEC are unset")
		return mountedWorkspace{}
	}

	s, from, err := workspaceMount.resolve()
	if err != nil {
		log.Error("could not load the workspace spec", "from", from, "error", err.Error())
		os.Exit(1)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Error("could not open the workspace database", "error", err.Error())
		os.Exit(1)
	}
	limitModulePool(db)

	if err := workspace.Migrate(db, s); err != nil {
		log.Error("could not migrate the workspace tables", "error", err.Error())
		os.Exit(1)
	}

	wm, err := workspace.NewWorkspaceManager(db, s)
	if err != nil {
		log.Error("could not build the workspace manager", "error", err.Error())
		os.Exit(1)
	}

	out := mountedWorkspace{manager: wm}
	if workspace.DeclaresLayouts(s) {
		lm, err := workspace.NewLayoutManager(db, s)
		if err != nil {
			log.Error("could not build the layout manager", "error", err.Error())
			os.Exit(1)
		}
		out.layouts = lm
	} else {
		log.Info("no layouts mounted", "reason", "the workspace spec fills none of layout, layout_change and layout_choice")
	}

	log.Info("workspace mounted", "instance", s.Instance, "module", s.Module, "domain", s.Domain,
		"from", from, "layouts", out.layouts != nil)
	return out
}
