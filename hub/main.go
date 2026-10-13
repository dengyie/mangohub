package main

import (
	"log/slog"

	"github.com/dengyie/mangohub/hub/cmd"
	"github.com/dengyie/mangohub/hub/utils"
	logger "github.com/dengyie/mangohub/hub/utils/log"
)

func main() {
	if utils.VersionHash == "unknown" {
		logger.Setup(slog.LevelDebug)
	} else {
		logger.Setup(slog.LevelInfo)
	}

	logger.Infof("server", "Mangohub %s (hash: %s)", utils.CurrentVersion, utils.VersionHash)

	cmd.Execute()
}
