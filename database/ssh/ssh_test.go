package ssh

import (
	"testing"
	"time"

	"github.com/komari-monitor/komari/cmd/flags"
	"github.com/komari-monitor/komari/database/dbcore"
	"github.com/komari-monitor/komari/database/models"
)

func TestSSHKeyAndTicketCRUD(t *testing.T) {
	flags.DatabaseType = flags.DatabaseTypeSQLite
	flags.DatabaseFile = "file:ssh_test_db?mode=memory&cache=shared"
	_ = dbcore.GetDBInstance()

	pub, priv, fp, err := models.GenerateEd25519Keypair("test-key")
	if err != nil {
		t.Fatalf("GenerateEd25519Keypair failed: %v", err)
	}

	key, err := CreateSSHKey("test-fleet-key", "global", "", "test key", pub, priv)
	if err != nil {
		t.Fatalf("CreateSSHKey failed: %v", err)
	}
	if key.ID == "" || key.Fingerprint != fp {
		t.Fatalf("Invalid key returned: %+v", key)
	}

	fetched, err := GetSSHKeyByID(key.ID)
	if err != nil {
		t.Fatalf("GetSSHKeyByID failed: %v", err)
	}
	decPriv, err := GetDecryptedPrivateKey(fetched)
	if err != nil {
		t.Fatalf("GetDecryptedPrivateKey failed: %v", err)
	}
	if decPriv != priv {
		t.Fatalf("Decrypted private key mismatch")
	}

	keys, err := ListSSHKeys()
	if err != nil || len(keys) == 0 {
		t.Fatalf("ListSSHKeys failed or empty: %v", err)
	}

	// Test ticket with ephemeral keypair
	ticket, ephemPriv, err := CreateSSHTicket("client-a", "client-b", key.ID, "ubuntu", "10.144.144.82", 22, "127.0.0.1", time.Hour)
	if err != nil {
		t.Fatalf("CreateSSHTicket failed: %v", err)
	}
	if ticket.Status != "active" || ticket.PublicKey == "" || ephemPriv == "" {
		t.Fatalf("Ticket status or ephemeral keypair invalid, got %+v", ticket)
	}

	decEphemPriv, err := GetTicketDecryptedPrivateKey(ticket)
	if err != nil {
		t.Fatalf("GetTicketDecryptedPrivateKey failed: %v", err)
	}
	if decEphemPriv != ephemPriv {
		t.Fatalf("Decrypted ephemeral private key mismatch")
	}

	active, err := FindActiveTicket("client-a", "client-b")
	if err != nil || active == nil {
		t.Fatalf("FindActiveTicket failed: %v", err)
	}

	if err := RevokeSSHTicket(ticket.TicketID); err != nil {
		t.Fatalf("RevokeSSHTicket failed: %v", err)
	}

	revoked, err := GetSSHTicketByID(ticket.TicketID)
	if err != nil || revoked.Status != "revoked" {
		t.Fatalf("Ticket should be revoked, got: %+v", revoked)
	}

	// 清理该测试创建的 key，避免污染后续测试
	_ = DeleteSSHKey(key.ID)
}

func TestEnsureDefaultFleetKey(t *testing.T) {
	flags.DatabaseType = flags.DatabaseTypeSQLite
	flags.DatabaseFile = "file:ssh_seed_test_db?mode=memory&cache=shared"
	_ = dbcore.GetDBInstance()

	if err := EnsureDefaultFleetKey(); err != nil {
		t.Fatalf("EnsureDefaultFleetKey failed: %v", err)
	}

	keys, err := ListSSHKeys()
	if err != nil || len(keys) == 0 {
		t.Fatalf("Expected seeded keys, got empty or error: %v", err)
	}

	found := false
	for _, k := range keys {
		if k.Name == "mangohub-fleet-master" && k.Scope == "global" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("mangohub-fleet-master key not found in keys")
	}
}
