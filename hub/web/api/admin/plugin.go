package admin

import (
	"net/http"
	"strings"

	"github.com/dengyie/mangohub/hub/internal/plugin"
	"github.com/gin-gonic/gin"
)

// ServePluginFile serves a static file from an installed plugin directory,
// used by injected plugin admin pages.
func ServePluginFile(c *gin.Context) {
	name := strings.TrimPrefix(c.Param("filepath"), "/")
	full, err := plugin.ResolveFile(c.Param("short"), name)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	c.File(full)
}
