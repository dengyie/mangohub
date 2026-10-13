package ssh

import (
	"github.com/dengyie/mangohub/hub/database/dbcore"
	"github.com/dengyie/mangohub/hub/database/models"
	logger "github.com/dengyie/mangohub/hub/utils/log"
)

// EnsureDefaultFleetKey 确保数据库中至少存在一个合法的 Global Fleet 密钥。
// 如果没有任何 global 作用域的密钥，则在内存中动态生成 Ed25519 密钥对并加密存储到数据库，
// 彻底摒弃从物理磁盘明文文件扫描或提交私钥的模式。
func EnsureDefaultFleetKey() error {
	var count int64
	db := dbcore.GetDBInstance()
	if err := db.Model(&models.SSHKey{}).Where("scope = ?", "global").Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		return nil
	}

	key, _, err := GenerateAndSaveSSHKey("mangohub-fleet-master", "global", "", "System generated fleet root SSH key")
	if err != nil {
		logger.Errorf("ssh", "Failed to generate default fleet SSH key: %v", err)
		return err
	}

	logger.Infof("ssh", "Successfully generated and vaulted default fleet SSH key: %s (fingerprint: %s, ID: %s)", key.Name, key.Fingerprint, key.ID)
	return nil
}
