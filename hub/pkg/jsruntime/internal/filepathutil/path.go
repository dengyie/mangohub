package filepathutil

import (
	"fmt"
	"path/filepath"
	"strings"
)

func RelativeToBase(baseDir, name string) (string, error) {
	absolute, err := filepath.Abs(name)
	if err != nil {
		return "", fmt.Errorf("resolve JavaScript path: %w", err)
	}
	absolute = filepath.Clean(absolute)
	if !WithinBase(baseDir, absolute) {
		return "", fmt.Errorf("JavaScript path escapes BaseDir: %s", name)
	}
	relative, err := filepath.Rel(baseDir, absolute)
	if err != nil {
		return "", fmt.Errorf("make JavaScript path relative to BaseDir: %w", err)
	}
	if relative == "." {
		return ".", nil
	}
	return relative, nil
}

func WithinBase(baseDir, path string) bool {
	relative, err := filepath.Rel(baseDir, path)
	if err != nil || filepath.IsAbs(relative) {
		return false
	}
	return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

// EvalCanonicalPath resolves symlinks on name. If name does not exist yet (e.g.
// a target file being created), it resolves symlinks on the nearest existing parent directory.
func EvalCanonicalPath(name string) string {
	if evaled, err := filepath.EvalSymlinks(name); err == nil {
		return filepath.Clean(evaled)
	}
	dir := filepath.Dir(name)
	base := filepath.Base(name)
	if evaledDir, err := filepath.EvalSymlinks(dir); err == nil {
		return filepath.Clean(filepath.Join(evaledDir, base))
	}
	return filepath.Clean(name)
}
