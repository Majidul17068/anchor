// Package market implements the Anchor Marketplace without a server. A
// public GitHub repository holds a JSON index of listings and requests;
// Anchor reads it over HTTPS, installs skills from it, and sends
// publications and requests back as GitHub issues/pull requests opened in
// the browser.
package market

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/skills"
	"github.com/Majidul17068/anchor/internal/store"
)

const (
	DefaultRepo     = "Majidul17068/anchor-marketplace"
	DefaultIndexURL = "https://raw.githubusercontent.com/" + DefaultRepo + "/main/index.json"
	cacheTTL        = 10 * time.Minute
	pageSize        = 24
)

type Index struct {
	Version  int                       `json:"version"`
	Repo     string                    `json:"repo"`
	Listings []model.Listing           `json:"listings"`
	Featured []string                  `json:"featured"`
	Requests []model.SkillRequest      `json:"requests"`
	Reviews  map[string][]model.Review `json:"reviews"`
}

type Service struct {
	st      *store.Store
	sk      *skills.Service
	openURL func(string)
	me      func() model.MarketAuthor
	logf    func(string, ...any)
	http    *http.Client

	mu        sync.Mutex
	cached    *Index
	fetchedAt time.Time
}

func New(st *store.Store, sk *skills.Service, openURL func(string), me func() model.MarketAuthor, logf func(string, ...any)) *Service {
	if logf == nil {
		logf = func(string, ...any) {}
	}
	return &Service{st: st, sk: sk, openURL: openURL, me: me, logf: logf, http: &http.Client{Timeout: 30 * time.Second}}
}

func (s *Service) indexURL() string {
	if v := s.st.SettingString("marketIndexUrl"); v != "" {
		return v
	}
	return DefaultIndexURL
}

func (s *Service) repo() string {
	if idx := s.cachedIndex(); idx != nil && idx.Repo != "" {
		return idx.Repo
	}
	if v := s.st.SettingString("marketRepo"); v != "" {
		return v
	}
	return DefaultRepo
}

func (s *Service) cachedIndex() *Index {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cached
}

// Index returns the catalog, from memory, the HTTP source, or the on-disk cache.
func (s *Service) Index(ctx context.Context, force bool) (*Index, error) {
	s.mu.Lock()
	if s.cached != nil && !force && time.Since(s.fetchedAt) < cacheTTL {
		idx := s.cached
		s.mu.Unlock()
		return idx, nil
	}
	s.mu.Unlock()

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, s.indexURL(), nil)
	req.Header.Set("User-Agent", "Anchor")
	resp, err := s.http.Do(req)
	var idx Index
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			if derr := json.NewDecoder(io.LimitReader(resp.Body, 32<<20)).Decode(&idx); derr != nil {
				err = derr
			}
		} else {
			err = fmt.Errorf("marketplace index returned HTTP %d", resp.StatusCode)
		}
	}
	if err != nil {
		var disk Index
		if s.st.ReadBlob(paths.MarketDir(), "index", &disk) == nil {
			s.mu.Lock()
			s.cached, s.fetchedAt = &disk, time.Now()
			s.mu.Unlock()
			return &disk, nil
		}
		return &Index{}, fmt.Errorf("MARKET_OFFLINE: could not load the marketplace (%v)", err)
	}
	_ = s.st.WriteBlob(paths.MarketDir(), "index", idx)
	s.mu.Lock()
	s.cached, s.fetchedAt = &idx, time.Now()
	s.mu.Unlock()
	return &idx, nil
}

func (s *Service) decorate(l model.Listing) model.Listing {
	if l.Categories == nil {
		l.Categories = []string{}
	}
	if l.Files == nil {
		l.Files = []model.SkillFile{}
	}
	if l.Examples == nil {
		l.Examples = []model.SkillExample{}
	}
	if l.Changelog == nil {
		l.Changelog = []model.ChangelogEntry{}
	}
	if l.Visibility == "" {
		l.Visibility = "public"
	}
	if v, ok := s.sk.Installed()[l.ID]; ok {
		l.InstalledVersion = v
		l.SkillID = "skill_acquired_" + skills.Slug(l.Name)
	}
	return l
}

type SearchOpts struct {
	Category string `json:"category"`
	Sort     string `json:"sort"`
	Page     int    `json:"page"`
}

func (s *Service) Search(ctx context.Context, q string, o SearchOpts) (model.SearchResult, error) {
	idx, err := s.Index(ctx, false)
	if err != nil && len(idx.Listings) == 0 {
		return model.SearchResult{Items: []model.Listing{}}, err
	}
	q = strings.ToLower(strings.TrimSpace(q))
	var items []model.Listing
	for _, l := range idx.Listings {
		if l.Visibility == "unlisted" && q == "" {
			continue
		}
		if o.Category != "" && !containsFold(l.Categories, o.Category) {
			continue
		}
		if q != "" {
			hay := strings.ToLower(l.Name + " " + l.Tagline + " " + l.Description + " " + strings.Join(l.Categories, " ") + " " + l.Author.Name)
			if !strings.Contains(hay, q) {
				continue
			}
		}
		items = append(items, s.decorate(l))
	}
	switch o.Sort {
	case "newest":
		sort.SliceStable(items, func(i, j int) bool { return items[i].PublishedAt > items[j].PublishedAt })
	case "installs":
		sort.SliceStable(items, func(i, j int) bool { return items[i].Installs > items[j].Installs })
	case "rating":
		sort.SliceStable(items, func(i, j int) bool { return items[i].Rating > items[j].Rating })
	default: // trending: installs weighted by recency
		sort.SliceStable(items, func(i, j int) bool {
			return float64(items[i].Installs)*recency(items[i].UpdatedAt) > float64(items[j].Installs)*recency(items[j].UpdatedAt)
		})
	}
	page := o.Page
	if page < 1 {
		page = 1
	}
	start := (page - 1) * pageSize
	if start > len(items) {
		start = len(items)
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	res := model.SearchResult{Items: items[start:end]}
	if res.Items == nil {
		res.Items = []model.Listing{}
	}
	if end < len(items) {
		n := page + 1
		res.NextPage = &n
	}
	return res, nil
}

func recency(ts string) float64 {
	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return 1
	}
	days := time.Since(t).Hours() / 24
	if days < 1 {
		days = 1
	}
	return 1 + 30/days
}

func containsFold(list []string, v string) bool {
	for _, x := range list {
		if strings.EqualFold(x, v) {
			return true
		}
	}
	return false
}

func (s *Service) Featured(ctx context.Context) ([]model.Listing, error) {
	idx, err := s.Index(ctx, false)
	if err != nil && len(idx.Listings) == 0 {
		return []model.Listing{}, err
	}
	want := map[string]bool{}
	for _, id := range idx.Featured {
		want[id] = true
	}
	var out []model.Listing
	for _, l := range idx.Listings {
		if want[l.ID] {
			out = append(out, s.decorate(l))
		}
	}
	if len(out) == 0 {
		res, _ := s.Search(ctx, "", SearchOpts{Sort: "trending"})
		if len(res.Items) > 6 {
			res.Items = res.Items[:6]
		}
		out = res.Items
	}
	if out == nil {
		out = []model.Listing{}
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id string) (model.Listing, error) {
	idx, err := s.Index(ctx, false)
	if err != nil && len(idx.Listings) == 0 {
		return model.Listing{}, err
	}
	for _, l := range idx.Listings {
		if l.ID == id {
			return s.decorate(l), nil
		}
	}
	for _, l := range s.localListings() {
		if l.ID == id {
			return s.decorate(l), nil
		}
	}
	return model.Listing{}, errors.New("listing not found")
}

func (s *Service) Reviews(ctx context.Context, id string) ([]model.Review, error) {
	idx, _ := s.Index(ctx, false)
	if idx != nil && idx.Reviews != nil {
		if r, ok := idx.Reviews[id]; ok && r != nil {
			return r, nil
		}
	}
	return []model.Review{}, nil
}

// Review opens the listing's discussion thread on GitHub; reviews are
// moderated there and folded into the index.
func (s *Service) Review(ctx context.Context, id string, rating int, text string) (model.Review, error) {
	l, err := s.Get(ctx, id)
	if err != nil {
		return model.Review{}, err
	}
	title := fmt.Sprintf("[review] %s — %d/5", l.Name, rating)
	s.open(s.issueURL(title, fmt.Sprintf("Listing: %s\nRating: %d/5\n\n%s", l.ID, rating, text), "review"))
	return model.Review{ID: "pending", ListingID: id, Author: s.me(), Rating: rating, Text: text, At: store.Now()}, nil
}

func (s *Service) issueURL(title, body, label string) string {
	v := url.Values{}
	v.Set("title", title)
	v.Set("body", body)
	if label != "" {
		v.Set("labels", label)
	}
	return "https://github.com/" + s.repo() + "/issues/new?" + v.Encode()
}

func (s *Service) open(u string) {
	if s.openURL != nil {
		s.openURL(u)
	}
}

// Install downloads a listing's files and adds them to Mine → Acquired.
func (s *Service) Install(ctx context.Context, id string) (*model.Skill, error) {
	l, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	files := l.Files
	if len(files) == 0 && l.BundleURL != "" {
		files, err = s.downloadBundle(ctx, l.BundleURL)
		if err != nil {
			return nil, err
		}
	}
	if len(files) == 0 {
		return nil, errors.New("this listing has no files to install")
	}
	return s.sk.Install(l.Name, "acquired", l.Author.Name, l.Version, files, l.Examples, l.ID)
}

func (s *Service) downloadBundle(ctx context.Context, u string) ([]model.SkillFile, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	req.Header.Set("User-Agent", "Anchor")
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bundle download returned HTTP %d", resp.StatusCode)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		return nil, err
	}
	zr, err := zip.NewReader(bytes.NewReader(b), int64(len(b)))
	if err != nil {
		return nil, fmt.Errorf("bundle is not a zip: %w", err)
	}
	var files []model.SkillFile
	for _, f := range zr.File {
		if f.FileInfo().IsDir() || f.UncompressedSize64 > 1<<20 {
			continue
		}
		name := f.Name
		// Strip a single top-level folder.
		if i := strings.Index(name, "/"); i >= 0 && !strings.Contains(name[i+1:], "SKILL.md") && strings.Count(name, "/") >= 1 {
			if strings.HasSuffix(name, "SKILL.md") || true {
				name = name[i+1:]
			}
		}
		if name == "" || strings.HasPrefix(name, "..") || strings.HasPrefix(name, "/") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			continue
		}
		content, _ := io.ReadAll(rc)
		rc.Close()
		if utf8.Valid(content) {
			files = append(files, model.SkillFile{Path: name, Content: string(content)})
		}
	}
	return files, nil
}

func (s *Service) Uninstall(id string) error { return s.sk.Uninstall(id) }

func (s *Service) CheckUpdates(ctx context.Context) ([]model.UpdateAvailable, error) {
	idx, err := s.Index(ctx, true)
	if err != nil && len(idx.Listings) == 0 {
		return []model.UpdateAvailable{}, err
	}
	installed := s.sk.Installed()
	var out []model.UpdateAvailable
	for _, l := range idx.Listings {
		if v, ok := installed[l.ID]; ok && v != "" && l.Version != "" && l.Version != v {
			out = append(out, model.UpdateAvailable{ListingID: l.ID, From: v, To: l.Version})
		}
	}
	if out == nil {
		out = []model.UpdateAvailable{}
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// publishing (serverless: a zip + listing.json submitted as a GitHub issue)
// ---------------------------------------------------------------------------

type PublishInput struct {
	Name        string   `json:"name"`
	Tagline     string   `json:"tagline"`
	Description string   `json:"description"`
	Categories  []string `json:"categories"`
	Visibility  string   `json:"visibility"`
	License     string   `json:"license"`
}

func (s *Service) localListings() []model.Listing {
	var out []model.Listing
	_ = s.st.ReadBlob(paths.MarketDir(), "my-listings", &out)
	return out
}

func (s *Service) saveLocalListings(list []model.Listing) error {
	return s.st.WriteBlob(paths.MarketDir(), "my-listings", list)
}

func (s *Service) Publish(ctx context.Context, skillID string, in PublishInput) (model.Listing, error) {
	sk, err := s.sk.Get(skillID)
	if err != nil {
		return model.Listing{}, err
	}
	if len(strings.TrimSpace(in.Description)) < 40 {
		return model.Listing{}, errors.New("description must be at least 40 characters")
	}
	if findSecret(sk.Files) {
		return model.Listing{}, errors.New("a file looks like it contains a secret (API key or token); remove it before publishing")
	}
	me := s.me()
	slug := skills.Slug(in.Name)
	id := me.ID + "/" + slug
	now := store.Now()
	trained := false
	for _, ex := range sk.Examples {
		if ex.LastResult != nil && ex.LastResult.Pass {
			trained = true
		}
	}
	listing := model.Listing{ID: id, SkillID: sk.ID, Name: in.Name, Tagline: in.Tagline, Description: in.Description, Version: sk.Version,
		Author: me, Categories: in.Categories, Trained: trained, Visibility: in.Visibility, License: in.License, Files: sk.Files,
		Examples: sk.Examples, Changelog: []model.ChangelogEntry{{Version: sk.Version, At: now, Notes: "Initial submission"}}, PublishedAt: now, UpdatedAt: now}
	if listing.Categories == nil {
		listing.Categories = []string{}
	}
	if listing.Visibility == "" {
		listing.Visibility = "public"
	}

	// Write the submission bundle: listing.json + skill.zip.
	dir := filepath.Join(paths.MarketDir(), "submissions", slug)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return model.Listing{}, err
	}
	lb, _ := json.MarshalIndent(listing, "", "  ")
	if err := os.WriteFile(filepath.Join(dir, "listing.json"), lb, 0o644); err != nil {
		return model.Listing{}, err
	}
	var zb bytes.Buffer
	zw := zip.NewWriter(&zb)
	for _, f := range sk.Files {
		w, err := zw.Create(slug + "/" + f.Path)
		if err == nil {
			_, _ = w.Write([]byte(f.Content))
		}
	}
	_ = zw.Close()
	if err := os.WriteFile(filepath.Join(dir, slug+".zip"), zb.Bytes(), 0o644); err != nil {
		return model.Listing{}, err
	}

	// Remember locally and open the submission issue.
	list := s.localListings()
	replaced := false
	for i := range list {
		if list[i].ID == id {
			list[i] = listing
			replaced = true
		}
	}
	if !replaced {
		list = append(list, listing)
	}
	if err := s.saveLocalListings(list); err != nil {
		return model.Listing{}, err
	}
	body := fmt.Sprintf("Skill submission from Anchor.\n\n- Name: %s\n- Tagline: %s\n- Version: %s\n- Categories: %s\n- License: %s\n- Visibility: %s\n\n%s\n\nAttach the files from this folder to this issue:\n`%s`\n(listing.json and %s.zip)",
		in.Name, in.Tagline, sk.Version, strings.Join(listing.Categories, ", "), in.License, listing.Visibility, in.Description, dir, slug)
	s.open(s.issueURL("[skill] "+in.Name, body, "submission"))
	s.openFolder(dir)
	return s.decorate(listing), nil
}

func (s *Service) openFolder(dir string) {
	s.open("file://" + filepath.ToSlash(dir))
}

func (s *Service) Unpublish(ctx context.Context, listingID string) error {
	list := s.localListings()
	var keep []model.Listing
	for _, l := range list {
		if l.ID != listingID {
			keep = append(keep, l)
		}
	}
	if keep == nil {
		keep = []model.Listing{}
	}
	if err := s.saveLocalListings(keep); err != nil {
		return err
	}
	s.open(s.issueURL("[unpublish] "+listingID, "Please remove listing `"+listingID+"` from the index.", "unpublish"))
	return nil
}

func (s *Service) MyListings(ctx context.Context) ([]model.Listing, error) {
	me := s.me()
	out := []model.Listing{}
	seen := map[string]bool{}
	if idx, _ := s.Index(ctx, false); idx != nil {
		for _, l := range idx.Listings {
			if l.Author.ID == me.ID {
				out = append(out, s.decorate(l))
				seen[l.ID] = true
			}
		}
	}
	for _, l := range s.localListings() {
		if !seen[l.ID] {
			l.Visibility = "unlisted" // pending review
			out = append(out, s.decorate(l))
		}
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// requests (GitHub issues mirrored into the index)
// ---------------------------------------------------------------------------

func (s *Service) localRequests() []model.SkillRequest {
	var out []model.SkillRequest
	_ = s.st.ReadBlob(paths.MarketDir(), "my-requests", &out)
	return out
}

func (s *Service) Requests(ctx context.Context, filter string) ([]model.SkillRequest, error) {
	me := s.me()
	var all []model.SkillRequest
	if idx, _ := s.Index(ctx, false); idx != nil {
		all = append(all, idx.Requests...)
	}
	seen := map[string]bool{}
	for _, r := range all {
		seen[r.ID] = true
	}
	for _, r := range s.localRequests() {
		if !seen[r.ID] {
			all = append(all, r)
		}
	}
	out := []model.SkillRequest{}
	for _, r := range all {
		if r.Replies == nil {
			r.Replies = []model.RequestReply{}
		}
		if r.Status == "" {
			r.Status = "open"
		}
		switch filter {
		case "mine":
			if r.Requester.ID != me.ID {
				continue
			}
		case "to_me":
			if r.ToAuthor == nil || r.ToAuthor.ID != me.ID {
				continue
			}
		}
		out = append(out, r)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].At > out[j].At })
	return out, nil
}

type RequestInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Bounty      string `json:"bounty"`
	ToAuthorID  string `json:"toAuthorId"`
}

func (s *Service) CreateRequest(ctx context.Context, in RequestInput) (model.SkillRequest, error) {
	me := s.me()
	r := model.SkillRequest{ID: fmt.Sprintf("local-%d", time.Now().UnixNano()), Title: in.Title, Description: in.Description, Bounty: in.Bounty,
		Requester: me, Status: "open", Replies: []model.RequestReply{}, At: store.Now()}
	body := in.Description
	if in.Bounty != "" {
		body += "\n\nBounty: " + in.Bounty
	}
	if in.ToAuthorID != "" {
		r.ToAuthor = &model.MarketAuthor{ID: in.ToAuthorID, Name: in.ToAuthorID}
		body += "\n\nRequested from: " + in.ToAuthorID
	}
	r.URL = s.issueURL("[request] "+in.Title, body, "request")
	list := append(s.localRequests(), r)
	if err := s.st.WriteBlob(paths.MarketDir(), "my-requests", list); err != nil {
		return r, err
	}
	s.open(r.URL)
	return r, nil
}

func (s *Service) ReplyRequest(ctx context.Context, id, text, listingID string) (model.SkillRequest, error) {
	reqs, _ := s.Requests(ctx, "all")
	for _, r := range reqs {
		if r.ID == id {
			if r.URL != "" {
				s.open(r.URL)
			} else {
				s.open("https://github.com/" + s.repo() + "/issues?q=" + url.QueryEscape(r.Title))
			}
			r.Replies = append(r.Replies, model.RequestReply{Author: s.me(), ListingID: listingID, Text: text, At: store.Now()})
			r.Status = "answered"
			return r, nil
		}
	}
	return model.SkillRequest{}, errors.New("request not found")
}

func (s *Service) FulfillRequest(ctx context.Context, id string) (model.SkillRequest, error) {
	list := s.localRequests()
	for i := range list {
		if list[i].ID == id {
			list[i].Status = "fulfilled"
			_ = s.st.WriteBlob(paths.MarketDir(), "my-requests", list)
			return list[i], nil
		}
	}
	reqs, _ := s.Requests(ctx, "all")
	for _, r := range reqs {
		if r.ID == id {
			r.Status = "fulfilled"
			if r.URL != "" {
				s.open(r.URL)
			}
			return r, nil
		}
	}
	return model.SkillRequest{}, errors.New("request not found")
}

// ---------------------------------------------------------------------------
// notifications (derived locally)
// ---------------------------------------------------------------------------

func (s *Service) Notifications(ctx context.Context) ([]model.Notification, error) {
	read := map[string]bool{}
	_ = s.st.ReadBlob(paths.MarketDir(), "notifications-read", &read)
	var out []model.Notification
	if ups, err := s.CheckUpdates(ctx); err == nil {
		for _, u := range ups {
			id := "update:" + u.ListingID + ":" + u.To
			out = append(out, model.Notification{ID: id, Kind: "update", Text: fmt.Sprintf("Update available for %s: %s → %s", u.ListingID, u.From, u.To), At: store.Now(), Read: read[id], Link: u.ListingID})
		}
	}
	if reqs, err := s.Requests(ctx, "to_me"); err == nil {
		for _, r := range reqs {
			id := "request:" + r.ID
			out = append(out, model.Notification{ID: id, Kind: "request", Text: "Skill requested from you: " + r.Title, At: r.At, Read: read[id], Link: r.URL})
		}
	}
	if out == nil {
		out = []model.Notification{}
	}
	return out, nil
}

func (s *Service) MarkRead(ids []string) error {
	read := map[string]bool{}
	_ = s.st.ReadBlob(paths.MarketDir(), "notifications-read", &read)
	for _, id := range ids {
		read[id] = true
	}
	return s.st.WriteBlob(paths.MarketDir(), "notifications-read", read)
}

var secretMarkers = []string{"AKIA", "sk-ant-", "sk_live_", "ghp_", "AIza", "-----BEGIN PRIVATE KEY-----", "xoxb-"}

func findSecret(files []model.SkillFile) bool {
	for _, f := range files {
		for _, m := range secretMarkers {
			if strings.Contains(f.Content, m) {
				return true
			}
		}
	}
	return false
}
