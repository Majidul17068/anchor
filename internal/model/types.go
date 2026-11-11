// Package model holds the data types shared between the Go backend and the
// React UI. Field names and JSON tags mirror frontend/src/bridge/types.ts
// exactly; keep the two in sync.
package model

type Plan string

const (
	PlanPro     Plan = "google_ai_pro"
	PlanUltra   Plan = "google_ai_ultra"
	PlanFree    Plan = "free"
	PlanUnknown Plan = "unknown"
)

type Effort string // low | medium | high | xhigh | max

type Mode string // default | plan | auto | accept-edits

type Account struct {
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl,omitempty"`
	Plan      Plan   `json:"plan"`
}

type Device struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Platform     string `json:"platform"` // darwin | win32 | linux
	LastSeen     string `json:"lastSeen"`
	IsThisDevice bool   `json:"isThisDevice"`
}

type Model struct {
	ID               string   `json:"id"`
	Label            string   `json:"label"`
	Family           string   `json:"family"` // gemini | claude | other
	ReasoningEfforts []Effort `json:"reasoningEfforts,omitempty"`
}

type Project struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	WorkspacePaths []string `json:"workspacePaths"`
}

type SyncState string

const (
	SyncLocal     SyncState = "local"
	SyncPublished SyncState = "published"
	SyncReplica   SyncState = "replica"
	SyncConflict  SyncState = "conflict"
)

type Session struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	Preview        string    `json:"preview"`
	AgentID        string    `json:"agentId,omitempty"`
	ModelID        string    `json:"modelId"`
	Effort         Effort    `json:"effort"`
	Mode           Mode      `json:"mode"`
	ProjectID      string    `json:"projectId,omitempty"`
	WorkspacePaths []string  `json:"workspacePaths"`
	OriginDeviceID string    `json:"originDeviceId"`
	SyncEnabled    bool      `json:"syncEnabled"`
	SyncState      SyncState `json:"syncState"`
	StepCount      int       `json:"stepCount"`
	CreatedAt      string    `json:"createdAt"`
	LastModified   string    `json:"lastModified"`
	Pinned         bool      `json:"pinned"`
}

type Attachment struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Mime string `json:"mime"`
	Size int64  `json:"size"`
}

// Step is the discriminated union used by the transcript. Only the fields
// relevant to Kind are populated; omitempty keeps the JSON identical to the
// TypeScript union members.
type Step struct {
	Kind string `json:"kind"` // user | agent | thinking | tool_call | permission | diff
	ID   string `json:"id"`
	At   string `json:"at"`

	// user
	Text        string       `json:"text,omitempty"`
	Attachments []Attachment `json:"attachments,omitempty"`

	// agent
	Markdown  string `json:"markdown,omitempty"`
	Streaming *bool  `json:"streaming,omitempty"`

	// tool_call
	Tool       string `json:"tool,omitempty"`
	Args       any    `json:"args,omitempty"`
	Status     string `json:"status,omitempty"` // pending | running | ok | error | denied
	Output     string `json:"output,omitempty"`
	DurationMs int64  `json:"durationMs,omitempty"`

	// permission
	Description string `json:"description,omitempty"`
	Resolved    string `json:"resolved,omitempty"` // once | always | deny

	// diff
	Path     string `json:"path,omitempty"`
	Patch    string `json:"patch,omitempty"`
	Accepted *bool  `json:"accepted,omitempty"`
}

type Agent struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Source       string   `json:"source"` // builtin | plugin | mine | shared
	Instructions string   `json:"instructions"`
	ModelID      string   `json:"modelId"`
	Effort       Effort   `json:"effort"`
	Tools        []string `json:"tools"`
	SkillIDs     []string `json:"skillIds"`
	MCPServers   []string `json:"mcpServers"`
}

type SkillFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type ExampleResult struct {
	Pass   bool   `json:"pass"`
	Output string `json:"output"`
}

type SkillExample struct {
	ID         string         `json:"id"`
	Prompt     string         `json:"prompt"`
	Expected   string         `json:"expected"`
	LastResult *ExampleResult `json:"lastResult,omitempty"`
}

type Share struct {
	Email      string `json:"email"`
	Permission string `json:"permission"` // view | copy
	SharedAt   string `json:"sharedAt"`
}

type Skill struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Version     string         `json:"version"`
	Author      string         `json:"author"`
	Source      string         `json:"source"` // builtin | plugin | mine | shared
	Triggers    []string       `json:"triggers"`
	Files       []SkillFile    `json:"files"`
	Examples    []SkillExample `json:"examples"`
	SharedWith  []Share        `json:"sharedWith"`
	UpdatedAt   string         `json:"updatedAt"`
}

type SkillVersion struct {
	Version string `json:"version"`
	At      string `json:"at"`
	Summary string `json:"summary"`
}

type EvalEvent struct {
	ExampleID string `json:"exampleId"`
	Pass      bool   `json:"pass"`
	Output    string `json:"output"`
	Done      bool   `json:"done,omitempty"`
}

// ChatEvent mirrors the TS ChatEvent union.
type ChatEvent struct {
	Type      string `json:"type"` // step | step_update | token | done | error
	Step      *Step  `json:"step,omitempty"`
	ID        string `json:"id,omitempty"`
	Patch     *Step  `json:"patch,omitempty"`
	StepID    string `json:"stepId,omitempty"`
	Delta     string `json:"delta,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
	Message   string `json:"message,omitempty"`
	Code      string `json:"code,omitempty"` // rate_limited | offline | auth | cli
}

type MarketAuthor struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type ChangelogEntry struct {
	Version string `json:"version"`
	At      string `json:"at"`
	Notes   string `json:"notes"`
}

type Listing struct {
	ID               string           `json:"id"`
	SkillID          string           `json:"skillId,omitempty"`
	Name             string           `json:"name"`
	Tagline          string           `json:"tagline"`
	Description      string           `json:"description"`
	Version          string           `json:"version"`
	Author           MarketAuthor     `json:"author"`
	Categories       []string         `json:"categories"`
	Installs         int              `json:"installs"`
	Rating           float64          `json:"rating"`
	RatingCount      int              `json:"ratingCount"`
	Trained          bool             `json:"trained"`
	Visibility       string           `json:"visibility"` // public | unlisted
	License          string           `json:"license"`
	Files            []SkillFile      `json:"files"`
	Examples         []SkillExample   `json:"examples"`
	Changelog        []ChangelogEntry `json:"changelog"`
	PublishedAt      string           `json:"publishedAt"`
	UpdatedAt        string           `json:"updatedAt"`
	InstalledVersion string           `json:"installedVersion,omitempty"`
	BundleURL        string           `json:"bundleUrl,omitempty"`
}

type Review struct {
	ID        string       `json:"id"`
	ListingID string       `json:"listingId"`
	Author    MarketAuthor `json:"author"`
	Rating    int          `json:"rating"`
	Text      string       `json:"text"`
	At        string       `json:"at"`
}

type RequestReply struct {
	Author    MarketAuthor `json:"author"`
	ListingID string       `json:"listingId,omitempty"`
	Text      string       `json:"text"`
	At        string       `json:"at"`
}

type SkillRequest struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Bounty      string         `json:"bounty,omitempty"`
	Requester   MarketAuthor   `json:"requester"`
	ToAuthor    *MarketAuthor  `json:"toAuthor,omitempty"`
	Status      string         `json:"status"` // open | answered | fulfilled
	Replies     []RequestReply `json:"replies"`
	At          string         `json:"at"`
	URL         string         `json:"url,omitempty"`
}

type Notification struct {
	ID   string `json:"id"`
	Kind string `json:"kind"` // update | request | reply | review | share
	Text string `json:"text"`
	At   string `json:"at"`
	Read bool   `json:"read"`
	Link string `json:"link,omitempty"`
}

type SyncStatus struct {
	DriveConnected bool   `json:"driveConnected"`
	DriveEmail     string `json:"driveEmail,omitempty"`
	LastSyncAt     string `json:"lastSyncAt,omitempty"`
	Pending        int    `json:"pending"`
	Conflicts      int    `json:"conflicts"`
	UsageBytes     int64  `json:"usageBytes"`
}

type Conflict struct {
	SessionID  string   `json:"sessionId"`
	Devices    []string `json:"devices"`
	ResolvedAs string   `json:"resolvedAs,omitempty"` // parent | merged
	At         string   `json:"at"`
}

type CliStatus struct {
	Installed       bool   `json:"installed"`
	Path            string `json:"path,omitempty"`
	Version         string `json:"version,omitempty"`
	UpdateAvailable string `json:"updateAvailable,omitempty"`
}

type InstallProgress struct {
	Phase   string `json:"phase"` // download | install | verify | done
	Percent int    `json:"percent"`
	Message string `json:"message"`
}

type UpdateAvailable struct {
	ListingID string `json:"listingId"`
	From      string `json:"from"`
	To        string `json:"to"`
}

type SearchResult struct {
	Items    []Listing `json:"items"`
	NextPage *int      `json:"nextPage,omitempty"`
}
