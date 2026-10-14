.PHONY: all build agent hub test clean

VERSION ?= $(shell git describe --tags --abbrev=0 2>/dev/null || echo "dev")
VERSION_HASH ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BIN_DIR := ./bin

all: agent hub
build: all

agent:
	@mkdir -p $(BIN_DIR)
	@echo "Building mango-agent ($(VERSION))..."
	cd agent && CGO_ENABLED=0 go build -trimpath \
		-ldflags="-s -w -X github.com/dengyie/mangohub/agent/update.CurrentVersion=$(VERSION)" \
		-o ../$(BIN_DIR)/mango-agent .
	@echo "Built: $(BIN_DIR)/mango-agent"

hub:
	@mkdir -p $(BIN_DIR)
	@echo "Building mangohub server ($(VERSION))..."
	cd hub && CGO_ENABLED=1 go build -trimpath \
		-ldflags="-s -w -X github.com/dengyie/mangohub/hub/utils.CurrentVersion=$(VERSION) -X github.com/dengyie/mangohub/hub/utils.VersionHash=$(VERSION_HASH)" \
		-o ../$(BIN_DIR)/mangohub .
	@echo "Built: $(BIN_DIR)/mangohub"

test:
	@echo "Testing agent..."
	cd agent && go test ./...
	@echo "Testing hub..."
	cd hub && go test ./...

clean:
	rm -rf $(BIN_DIR) ./agent/build
