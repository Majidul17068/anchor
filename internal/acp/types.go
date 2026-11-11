package acp

import "encoding/json"

// Wire types for the subset of ACP v1 that Anchor uses. Field names follow
// the protocol exactly.

type InitializeParams struct {
	ProtocolVersion    int                `json:"protocolVersion"`
	ClientCapabilities ClientCapabilities `json:"clientCapabilities"`
	ClientInfo         ClientInfo         `json:"clientInfo"`
}

type ClientInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type ClientCapabilities struct {
	FS       FSCapabilities `json:"fs"`
	Terminal bool           `json:"terminal"`
}

type FSCapabilities struct {
	ReadTextFile  bool `json:"readTextFile"`
	WriteTextFile bool `json:"writeTextFile"`
}

type AuthMethod struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type InitializeResult struct {
	ProtocolVersion   int             `json:"protocolVersion"`
	AgentCapabilities json.RawMessage `json:"agentCapabilities"`
	AgentInfo         struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	} `json:"agentInfo"`
	AuthMethods []AuthMethod `json:"authMethods"`
}

type SessionInfo struct {
	SessionID string `json:"sessionId"`
	Cwd       string `json:"cwd"`
	Title     string `json:"title"`
	UpdatedAt string `json:"updatedAt"`
}

type ListSessionsResult struct {
	Sessions   []SessionInfo `json:"sessions"`
	NextCursor string        `json:"nextCursor,omitempty"`
}

type ModelInfo struct {
	ModelID string `json:"modelId"`
	Name    string `json:"name"`
}

type ModeInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type ConfigOptionValue struct {
	Value       string `json:"value"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type ConfigOption struct {
	ID           string              `json:"id"`
	Name         string              `json:"name"`
	Category     string              `json:"category"`
	Type         string              `json:"type"`
	CurrentValue any                 `json:"currentValue"`
	Options      []ConfigOptionValue `json:"options"`
}

type Tier struct {
	Name       string `json:"name"`
	ID         string `json:"id"`
	UpgradeURI string `json:"upgradeUri"`
}

type SessionSetupResult struct {
	SessionID string `json:"sessionId"`
	Models    *struct {
		AvailableModels []ModelInfo `json:"availableModels"`
		CurrentModelID  string      `json:"currentModelId"`
	} `json:"models"`
	Modes *struct {
		CurrentModeID  string     `json:"currentModeId"`
		AvailableModes []ModeInfo `json:"availableModes"`
	} `json:"modes"`
	ConfigOptions []ConfigOption `json:"configOptions"`
	Meta          *struct {
		Antigravity *struct {
			Tier *Tier `json:"tier"`
		} `json:"antigravity"`
	} `json:"_meta"`
}

type ContentBlock struct {
	Type     string `json:"type"` // text | image | resource | resource_link
	Text     string `json:"text,omitempty"`
	Data     string `json:"data,omitempty"`
	MimeType string `json:"mimeType,omitempty"`
	URI      string `json:"uri,omitempty"`
	Name     string `json:"name,omitempty"`
	Resource *struct {
		URI      string `json:"uri"`
		MimeType string `json:"mimeType,omitempty"`
		Text     string `json:"text,omitempty"`
	} `json:"resource,omitempty"`
}

type PromptResult struct {
	StopReason string `json:"stopReason"`
	Usage      *struct {
		InputTokens  int64 `json:"inputTokens"`
		OutputTokens int64 `json:"outputTokens"`
		TotalTokens  int64 `json:"totalTokens"`
	} `json:"usage,omitempty"`
}

type ToolContent struct {
	Type    string        `json:"type"` // content | diff | terminal
	Content *ContentBlock `json:"content,omitempty"`
	Path    string        `json:"path,omitempty"`
	OldText *string       `json:"oldText,omitempty"`
	NewText string        `json:"newText,omitempty"`
}

type Location struct {
	Path string `json:"path"`
	Line *int   `json:"line,omitempty"`
}

// SessionUpdate is the union payload of session/update.params.update.
type SessionUpdate struct {
	SessionUpdate string        `json:"sessionUpdate"`
	Content       *ContentBlock `json:"content,omitempty"`
	MessageID     string        `json:"messageId,omitempty"`

	// tool_call / tool_call_update
	ToolCallID string          `json:"toolCallId,omitempty"`
	Title      string          `json:"title,omitempty"`
	Name       string          `json:"name,omitempty"`
	Kind       string          `json:"kind,omitempty"`
	Status     string          `json:"status,omitempty"`
	ToolItems  []ToolContent   `json:"-"`
	RawContent json.RawMessage `json:"-"`
	Locations  []Location      `json:"locations,omitempty"`
	RawInput   json.RawMessage `json:"rawInput,omitempty"`
	RawOutput  json.RawMessage `json:"rawOutput,omitempty"`
	Args       json.RawMessage `json:"args,omitempty"`

	// plan
	Entries []struct {
		Content  string `json:"content"`
		Priority string `json:"priority"`
		Status   string `json:"status"`
	} `json:"entries,omitempty"`

	// session_info_update
	// (Title reused)

	// current_mode_update
	CurrentModeID string `json:"currentModeId,omitempty"`

	// config_option_update
	ConfigOptions []ConfigOption `json:"configOptions,omitempty"`

	// available_commands_update
	AvailableCommands []struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	} `json:"availableCommands,omitempty"`
}

// UnmarshalJSON handles the "content" field, which is a single block for
// message chunks but an array of tool content items for tool calls.
func (u *SessionUpdate) UnmarshalJSON(b []byte) error {
	type alias SessionUpdate
	var raw struct {
		alias
		Content json.RawMessage `json:"content"`
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}
	*u = SessionUpdate(raw.alias)
	u.Content = nil
	if len(raw.Content) == 0 || string(raw.Content) == "null" {
		return nil
	}
	if raw.Content[0] == '[' {
		u.RawContent = raw.Content
		var items []ToolContent
		if err := json.Unmarshal(raw.Content, &items); err == nil {
			u.ToolItems = items
		}
		return nil
	}
	var block ContentBlock
	if err := json.Unmarshal(raw.Content, &block); err == nil {
		u.Content = &block
	}
	return nil
}

type SessionUpdateParams struct {
	SessionID string        `json:"sessionId"`
	Update    SessionUpdate `json:"update"`
}

type PermissionOption struct {
	OptionID string `json:"optionId"`
	Name     string `json:"name"`
	Kind     string `json:"kind"` // allow_once | allow_always | reject_once | reject_always
}

type RequestPermissionParams struct {
	SessionID string             `json:"sessionId"`
	ToolCall  SessionUpdate      `json:"toolCall"`
	Options   []PermissionOption `json:"options"`
}

type PermissionOutcome struct {
	Outcome  string `json:"outcome"` // selected | cancelled
	OptionID string `json:"optionId,omitempty"`
}

type RequestPermissionResult struct {
	Outcome PermissionOutcome `json:"outcome"`
}
