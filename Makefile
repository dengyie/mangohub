.PHONY: all build agent hub admin test clean

VERSION ?= $(shell git describe --tags --abbrev=0 2>/dev/null || echo "dev")
VERSION_HASH ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BIN_DIR := ./bin

all: agent hub
build: all

agent:
	@mkdir -p $(BIN_DIR)
	@echo "Building mangohub-agent ($(VERSION))..."
	cd agent && CGO_ENABLED=0 go build -trimpath \
		-ldflags="-s -w -X github.com/dengyie/mangohub/agent/update.CurrentVersion=$(VERSION)" \
		-o ../$(BIN_DIR)/mangohub-agent .
	@echo "Built: $(BIN_DIR)/mangohub-agent"

hub:
	@mkdir -p $(BIN_DIR)
	@echo "Building mangohub server ($(VERSION))..."
	cd hub && CGO_ENABLED=1 go build -trimpath \
		-ldflags="-s -w -X github.com/dengyie/mangohub/hub/utils.CurrentVersion=$(VERSION) -X github.com/dengyie/mangohub/hub/utils.VersionHash=$(VERSION_HASH)" \
		-o ../$(BIN_DIR)/mangohub .
	@echo "Built: $(BIN_DIR)/mangohub"

admin:
	@command -v npm >/dev/null 2>&1 || { echo "Error: npm is required but not installed"; exit 1; }
	@command -v zstd >/dev/null 2>&1 || { echo "Error: zstd is required but not installed"; exit 1; }
	@echo "Building admin frontend (Vite/React)..."
	cd hub/web/admin && npm install && npm run build
	@echo "Packaging dist.tar.zst for defaultTheme atomically..."
	@set -e; \
	TMP_TAR=$$(mktemp /tmp/mangohub-admin-tar.XXXXXX); \
	TMP_ZST=$$(mktemp /tmp/mangohub-admin-zst.XXXXXX); \
	trap 'rm -f "$$TMP_TAR" "$$TMP_ZST"' EXIT; \
	tar -cf "$$TMP_TAR" -C hub/web/admin/dist .; \
	zstd -19 -T0 -f "$$TMP_TAR" -o "$$TMP_ZST"; \
	[ -s "$$TMP_ZST" ] || { echo "Error: packaged archive is empty"; exit 1; }; \
	mv -f "$$TMP_ZST" hub/web/public/defaultTheme/dist.tar.zst
	@cp hub/web/admin/komari-theme.json hub/web/public/defaultTheme/komari-theme.json
	@echo "Admin frontend built and packaged successfully."

test:
	@echo "Testing agent..."
	cd agent && go test ./...
	@echo "Testing hub..."
	cd hub && go test ./...

clean:
	rm -rf $(BIN_DIR) ./agent/build ./hub/web/admin/dist
