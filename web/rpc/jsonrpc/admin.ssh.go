package jsonrpc

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/komari-monitor/komari/database/clients"
	"github.com/komari-monitor/komari/database/ssh"
	"github.com/komari-monitor/komari/pkg/rpc"
	v2 "github.com/komari-monitor/komari/protocol/v2"
	agent_runtime "github.com/komari-monitor/komari/web/agent"
)

// admin.ssh.go
// SSH 密钥管理与跨节点申请 RPC2 处理函数

func init() {
	// 管理员管理 SSH 密钥列表
	RegisterWithGroupAndMeta("listSSHKeys", rpc.RoleAdmin, adminListSSHKeys, &rpc.MethodMeta{
		Name:        "admin:listSSHKeys",
		Summary:     "List all managed SSH keys",
		Description: "Returns all registered SSH keys without revealing private keys",
		Returns:     "{ keys: SSHKey[] }",
	})

	// 管理员添加/导入 SSH 密钥
	RegisterWithGroupAndMeta("createSSHKey", rpc.RoleAdmin, adminCreateSSHKey, &rpc.MethodMeta{
		Name:        "admin:createSSHKey",
		Summary:     "Create or import an SSH key",
		Description: "Add a new public key (and optional private key) to the vault",
		Params: []rpc.ParamMeta{
			{Name: "name", Type: "string", Description: "Key name"},
			{Name: "public_key", Type: "string", Description: "SSH Public key string"},
			{Name: "private_key", Type: "string", Description: "Optional OpenSSH private key"},
			{Name: "scope", Type: "string", Description: "Scope: global/group/client"},
			{Name: "target_uuid", Type: "string", Description: "Target client UUID if scope is client"},
			{Name: "description", Type: "string", Description: "Description"},
		},
		Returns: "{ key: SSHKey }",
	})

	// 管理员自动生成 Ed25519 密钥对
	RegisterWithGroupAndMeta("generateSSHKey", rpc.RoleAdmin, adminGenerateSSHKey, &rpc.MethodMeta{
		Name:        "admin:generateSSHKey",
		Summary:     "Generate an Ed25519 SSH keypair",
		Description: "Automatically generate an Ed25519 keypair and store encrypted in vault",
		Params: []rpc.ParamMeta{
			{Name: "name", Type: "string", Description: "Key name"},
			{Name: "scope", Type: "string", Description: "Scope: global/group/client"},
			{Name: "target_uuid", Type: "string", Description: "Target client UUID if scope is client"},
			{Name: "description", Type: "string", Description: "Description"},
		},
		Returns: "{ key: SSHKey, private_key: string }",
	})

	// 管理员删除 SSH 密钥
	RegisterWithGroupAndMeta("deleteSSHKey", rpc.RoleAdmin, adminDeleteSSHKey, &rpc.MethodMeta{
		Name:        "admin:deleteSSHKey",
		Summary:     "Delete an SSH key",
		Description: "Remove an SSH key from the vault",
		Params: []rpc.ParamMeta{
			{Name: "id", Type: "string", Description: "SSH key ID"},
		},
		Returns: "{ success: boolean }",
	})

	// 跨节点互访申请 SSH 凭据（允许已认证的 Client 节点或 Admin 申请）
	RegisterWithGroupAndMeta("requestSSHTicket", rpc.RoleClient, clientRequestSSHTicket, &rpc.MethodMeta{
		Name:        "client:requestSSHTicket",
		Summary:     "Request SSH access ticket to target cloud host",
		Description: "Request authorization to SSH into another client device",
		Params: []rpc.ParamMeta{
			{Name: "source_client_uuid", Type: "string", Description: "Source client UUID (optional if calling via client token)"},
			{Name: "target_client_uuid", Type: "string", Description: "Target client UUID to access"},
			{Name: "duration_seconds", Type: "number", Description: "Desired duration in seconds (default 3600, max 86400)"},
			{Name: "target_user", Type: "string", Description: "Target login username (default ubuntu/root)"},
		},
		Returns: "{ ticket: SSHTicket, private_key: string, target_info: object }",
	})

	// 吊销互访 Ticket
	RegisterWithGroupAndMeta("revokeSSHTicket", rpc.RoleClient, clientRevokeSSHTicket, &rpc.MethodMeta{
		Name:        "client:revokeSSHTicket",
		Summary:     "Revoke an active SSH access ticket",
		Description: "Revoke ticket and remove public key on target client immediately",
		Params: []rpc.ParamMeta{
			{Name: "ticket_id", Type: "string", Description: "Ticket ID to revoke"},
		},
		Returns: "{ success: boolean }",
	})
}

func adminListSSHKeys(_ context.Context, _ *rpc.JsonRpcRequest) (any, *rpc.JsonRpcError) {
	keys, err := ssh.ListSSHKeys()
	if err != nil {
		return nil, rpc.MakeError(rpc.InternalError, "Failed to list SSH keys: "+err.Error(), nil)
	}
	return map[string]any{"keys": keys}, nil
}

func adminCreateSSHKey(_ context.Context, req *rpc.JsonRpcRequest) (any, *rpc.JsonRpcError) {
	var params struct {
		Name        string `json:"name"`
		PublicKey   string `json:"public_key"`
		PrivateKey  string `json:"private_key"`
		Scope       string `json:"scope"`
		TargetUUID  string `json:"target_uuid"`
		Description string `json:"description"`
	}
	if err := req.BindParams(&params); err != nil {
		return nil, rpc.MakeError(rpc.InvalidParams, err.Error(), nil)
	}
	if params.Name == "" || params.PublicKey == "" {
		return nil, rpc.MakeError(rpc.InvalidParams, "name and public_key are required", nil)
	}
	if params.Scope == "" {
		params.Scope = "global"
	}
	key, err := ssh.CreateSSHKey(params.Name, params.Scope, params.TargetUUID, params.Description, params.PublicKey, params.PrivateKey)
	if err != nil {
		return nil, rpc.MakeError(rpc.InternalError, err.Error(), nil)
	}
	return map[string]any{"key": key}, nil
}

func adminGenerateSSHKey(_ context.Context, req *rpc.JsonRpcRequest) (any, *rpc.JsonRpcError) {
	var params struct {
		Name        string `json:"name"`
		Scope       string `json:"scope"`
		TargetUUID  string `json:"target_uuid"`
		Description string `json:"description"`
	}
	if err := req.BindParams(&params); err != nil {
		return nil, rpc.MakeError(rpc.InvalidParams, err.Error(), nil)
	}
	if params.Name == "" {
		return nil, rpc.MakeError(rpc.InvalidParams, "name is required", nil)
	}
	if params.Scope == "" {
		params.Scope = "global"
	}
	key, privKey, err := ssh.GenerateAndSaveSSHKey(params.Name, params.Scope, params.TargetUUID, params.Description)
	if err != nil {
		return nil, rpc.MakeError(rpc.InternalError, err.Error(), nil)
	}
	return map[string]any{
		"key":         key,
		"private_key": privKey,
	}, nil
}

func adminDeleteSSHKey(_ context.Context, req *rpc.JsonRpcRequest) (any, *rpc.JsonRpcError) {
	var params struct {
		ID string `json:"id"`
	}
	if err := req.BindParams(&params); err != nil {
		return nil, rpc.MakeError(rpc.InvalidParams, err.Error(), nil)
	}
	if params.ID == "" {
		return nil, rpc.MakeError(rpc.InvalidParams, "id is required", nil)
	}
	if err := ssh.DeleteSSHKey(params.ID); err != nil {
		return nil, rpc.MakeError(rpc.InternalError, err.Error(), nil)
	}
	return map[string]any{"success": true}, nil
}

func clientRequestSSHTicket(ctx context.Context, req *rpc.JsonRpcRequest) (any, *rpc.JsonRpcError) {
	var params struct {
		SourceClientUUID string `json:"source_client_uuid"`
		TargetClientUUID string `json:"target_client_uuid"`
		DurationSeconds  int    `json:"duration_seconds"`
		TargetUser       string `json:"target_user"`
	}
	if err := req.BindParams(&params); err != nil {
		return nil, rpc.MakeError(rpc.InvalidParams, err.Error(), nil)
	}

	meta := rpc.MetaFromContext(ctx)

	// 权限与访问控制策略校验 (ACL Check):
	// 1. 如果调用方是 Admin (通过控制台/Admin Token发起)，拥有全局互访申请权限
	// 2. 如果调用方是 Client (Agent 节点之间申请)，严格校验来源身份并执行分组/标签/租户隔离
	isAdmin := meta != nil && (meta.Permission == rpc.RoleAdmin || meta.User != nil)

	sourceUUID := ""
	if meta != nil {
		if meta.ClientUUID != "" {
			sourceUUID = meta.ClientUUID
		} else if meta.ClientToken != "" {
			c, err := clients.GetClientUUIDByToken(meta.ClientToken)
			if err == nil && c != "" {
				sourceUUID = c
			}
		}
	}

	if isAdmin {
		if sourceUUID == "" {
			if params.SourceClientUUID != "" {
				sourceUUID = params.SourceClientUUID
			} else {
				sourceUUID = "admin-console"
			}
		}
	} else {
		// 普通 Client 节点调用：必须持有合法的 ClientToken，禁止伪造 source_client_uuid
		if sourceUUID == "" {
			return nil, rpc.MakeError(rpc.PermissionDenied, "Authentication required: client token missing or invalid", nil)
		}
	}

	if params.TargetClientUUID == "" {
		return nil, rpc.MakeError(rpc.InvalidParams, "target_client_uuid is required", nil)
	}

	targetClient, err := clients.GetClientByUUID(params.TargetClientUUID)
	if err != nil {
		return nil, rpc.MakeError(rpc.InvalidParams, "Target client not found", nil)
	}

	// 执行节点隔离矩阵检验
	if !isAdmin {
		// 禁止节点向自身申请
		if sourceUUID == params.TargetClientUUID {
			return nil, rpc.MakeError(rpc.InvalidParams, "Cannot request SSH ticket to self", nil)
		}

		sourceClient, err := clients.GetClientByUUID(sourceUUID)
		if err != nil {
			return nil, rpc.MakeError(rpc.PermissionDenied, "Source client record not found", nil)
		}

		// 默认策略：仅同组（Group 相同且非空）或拥有匹配标签的节点允许直接互访，防止跨组任意横向穿透
		sameGroup := sourceClient.Group != "" && sourceClient.Group == targetClient.Group
		hasExplicitAllow := false

		// 检查目标节点标签中是否允许所有或允许源节点组: "allow-ssh-fleet" 或 "allow-ssh:<sourceGroup>"
		targetTags := strings.Split(targetClient.Tags, ";")
		for _, tag := range targetTags {
			t := strings.TrimSpace(tag)
			if t == "allow-ssh-fleet" || t == "allow-ssh:all" {
				hasExplicitAllow = true
				break
			}
			if sourceClient.Group != "" && t == "allow-ssh-group:"+sourceClient.Group {
				hasExplicitAllow = true
				break
			}
		}

		if !sameGroup && !hasExplicitAllow {
			return nil, rpc.MakeError(rpc.PermissionDenied, fmt.Sprintf("Access denied: node %s is not authorized to access node %s (different group and no explicit allow tag)", sourceClient.Name, targetClient.Name), nil)
		}
	}

	// 寻找关联的配置项或全局公钥用于参考绑定
	keys, err := ssh.ListSSHKeys()
	if err != nil {
		return nil, rpc.MakeError(rpc.InternalError, "Failed to list vault keys: "+err.Error(), nil)
	}
	var selectedKeyID string
	for i := range keys {
		if keys[i].Scope == "client" && keys[i].TargetUUID == params.TargetClientUUID {
			selectedKeyID = keys[i].ID
			break
		}
	}
	if selectedKeyID == "" && len(keys) > 0 {
		selectedKeyID = keys[0].ID
	}

	duration := time.Duration(params.DurationSeconds) * time.Second
	if duration <= 0 {
		duration = 1 * time.Hour
	}
	if duration > 24*time.Hour {
		duration = 24 * time.Hour
	}

	targetUser := params.TargetUser
	if targetUser == "" {
		targetUser = "ubuntu"
		if targetClient.OS == "debian" || targetClient.OS == "centos" || targetClient.OS == "arch" {
			targetUser = "root"
		}
	}

	targetHost := targetClient.IPv4
	targetPort := 22

	// 支持从节点 Tags 中解析自定义端口或主机，例如 "ssh_port:2222;ssh_host:10.144.144.81"
	if targetClient.Tags != "" {
		for _, tag := range strings.Split(targetClient.Tags, ";") {
			t := strings.TrimSpace(tag)
			if strings.HasPrefix(t, "ssh_port:") {
				if p, err := strconv.Atoi(strings.TrimPrefix(t, "ssh_port:")); err == nil && p > 0 {
					targetPort = p
				}
			} else if strings.HasPrefix(t, "ssh_host:") {
				h := strings.TrimPrefix(t, "ssh_host:")
				if h != "" {
					targetHost = h
				}
			}
		}
	}

	if targetHost == "" {
		targetHost = "127.0.0.1"
	}

	remoteIP := ""
	if meta != nil {
		remoteIP = meta.RemoteIP
	}

	// 核心安全重构：为每个 Ticket 动态生成单次专属临时密钥对（Ephemeral Keypair）
	// ticket.PublicKey 注入目标节点，专属临时私钥 ephemPriv 返回给调用方，
	// 彻底杜绝全局主私钥泄露给客户端！
	ticket, ephemPriv, err := ssh.CreateSSHTicket(sourceUUID, params.TargetClientUUID, selectedKeyID, targetUser, targetHost, targetPort, remoteIP, duration)
	if err != nil {
		return nil, rpc.MakeError(rpc.InternalError, "Failed to create SSH ticket: "+err.Error(), nil)
	}

	// 向目标机 mango-agent 派发动态 authorized_keys 临时授权事件（携带单次临时公钥）
	agent_runtime.DispatchV2Event(params.TargetClientUUID, v2.MethodAgentSSHAuthorize, v2.SSHAuthorizeParams{
		TicketID:   ticket.TicketID,
		PublicKey:  ticket.PublicKey,
		TargetUser: targetUser,
		ExpiresAt:  ticket.ExpiresAt,
		SourceUUID: sourceUUID,
	})

	return map[string]any{
		"ticket":      ticket,
		"private_key": ephemPriv,
		"target_info": map[string]any{
			"uuid": targetClient.UUID,
			"name": targetClient.Name,
			"host": targetHost,
			"port": targetPort,
			"user": targetUser,
		},
		"ssh_command": fmt.Sprintf("ssh -p %d %s@%s", targetPort, targetUser, targetHost),
	}, nil
}

func clientRevokeSSHTicket(ctx context.Context, req *rpc.JsonRpcRequest) (any, *rpc.JsonRpcError) {
	var params struct {
		TicketID string `json:"ticket_id"`
	}
	if err := req.BindParams(&params); err != nil {
		return nil, rpc.MakeError(rpc.InvalidParams, err.Error(), nil)
	}
	if params.TicketID == "" {
		return nil, rpc.MakeError(rpc.InvalidParams, "ticket_id is required", nil)
	}

	ticket, err := ssh.GetSSHTicketByID(params.TicketID)
	if err != nil {
		return nil, rpc.MakeError(rpc.InvalidParams, "Ticket not found", nil)
	}

	meta := rpc.MetaFromContext(ctx)
	isAdmin := meta != nil && (meta.Permission == rpc.RoleAdmin || meta.User != nil)
	if !isAdmin {
		clientUUID := ""
		if meta != nil {
			if meta.ClientUUID != "" {
				clientUUID = meta.ClientUUID
			} else if meta.ClientToken != "" {
				c, err := clients.GetClientUUIDByToken(meta.ClientToken)
				if err == nil {
					clientUUID = c
				}
			}
		}
		if clientUUID == "" || (clientUUID != ticket.SourceClient && clientUUID != ticket.TargetClient) {
			return nil, rpc.MakeError(rpc.PermissionDenied, "Access denied: cannot revoke ticket owned by another node", nil)
		}
	}

	if err := ssh.RevokeSSHTicket(params.TicketID); err != nil {
		return nil, rpc.MakeError(rpc.InternalError, err.Error(), nil)
	}

	// 通知目标节点注销
	agent_runtime.DispatchV2Event(ticket.TargetClient, v2.MethodAgentSSHRevoke, v2.SSHRevokeParams{
		TicketID: ticket.TicketID,
	})

	return map[string]any{"success": true}, nil
}
