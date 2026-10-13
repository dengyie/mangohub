package messageSender

import (
	_ "github.com/dengyie/mangohub/hub/utils/messageSender/bark"
	_ "github.com/dengyie/mangohub/hub/utils/messageSender/email"
	_ "github.com/dengyie/mangohub/hub/utils/messageSender/empty"
	_ "github.com/dengyie/mangohub/hub/utils/messageSender/javascript"
	_ "github.com/dengyie/mangohub/hub/utils/messageSender/serverchan3"
	_ "github.com/dengyie/mangohub/hub/utils/messageSender/serverchanturbo"
	_ "github.com/dengyie/mangohub/hub/utils/messageSender/telegram"
	_ "github.com/dengyie/mangohub/hub/utils/messageSender/webhook"
)

func All() {
}
