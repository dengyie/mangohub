package main

import (
	"os"

	"github.com/dengyie/mangohub/agent/cmd"
)

func main() {
	cmd.Execute()
	os.Exit(0)
}
