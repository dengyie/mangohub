package oauth

import (
	_ "github.com/dengyie/mangohub/hub/web/oauth/factory"
	_ "github.com/dengyie/mangohub/hub/web/oauth/generic"
	_ "github.com/dengyie/mangohub/hub/web/oauth/github"
	_ "github.com/dengyie/mangohub/hub/web/oauth/qq"
)

func All() {
	//empty function to ensure all OIDC providers are registered
}
