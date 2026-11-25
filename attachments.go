package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
)

// Things pasted or dropped into the composer (a screenshot, a copied image,
// a file dragged from Finder, a long block of text) have no path the CLI
// could read. They are written under ~/.anchor/attachments and attached
// like any picked file.

const (
	maxAttachmentBytes = 25 << 20
	maxPreviewBytes    = 12 << 20
)

var unsafeName = regexp.MustCompile(`[^A-Za-z0-9._ -]+`)

func attachmentsDir() string { return filepath.Join(paths.AnchorDir(), "attachments") }

func imageMime(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	case ".bmp":
		return "image/bmp"
	}
	return ""
}

// SystemSaveAttachment stores pasted or dropped content (base64) as a file
// and returns it as an attachment.
func (a *API) SystemSaveAttachment(name, mimeType, dataBase64 string) (model.Attachment, error) {
	if i := strings.Index(dataBase64, ","); i >= 0 && strings.HasPrefix(dataBase64, "data:") {
		dataBase64 = dataBase64[i+1:]
	}
	data, err := base64.StdEncoding.DecodeString(dataBase64)
	if err != nil {
		return model.Attachment{}, errors.New("could not read the pasted content")
	}
	if len(data) == 0 {
		return model.Attachment{}, errors.New("the pasted content is empty")
	}
	if len(data) > maxAttachmentBytes {
		return model.Attachment{}, fmt.Errorf("that is %d MB; attachments can be up to %d MB", len(data)>>20, maxAttachmentBytes>>20)
	}
	name = strings.TrimSpace(unsafeName.ReplaceAllString(filepath.Base(name), "_"))
	if name == "" || name == "." {
		name = "pasted"
	}
	if filepath.Ext(name) == "" {
		if exts, _ := mime.ExtensionsByType(mimeType); len(exts) > 0 {
			name += exts[0]
		}
	}
	if mimeType == "" {
		if mimeType = mime.TypeByExtension(filepath.Ext(name)); mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}
	dir := filepath.Join(attachmentsDir(), time.Now().Format("2006-01-02"))
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return model.Attachment{}, err
	}
	path := filepath.Join(dir, uuid.NewString()[:8]+"-"+name)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return model.Attachment{}, err
	}
	return model.Attachment{Name: name, Path: path, Mime: mimeType, Size: int64(len(data))}, nil
}

// SystemImagePreview returns an image file as a data URL so the chat can
// show attached pictures. Only image files are served, whatever the path.
func (a *API) SystemImagePreview(path string) (string, error) {
	m := imageMime(path)
	if m == "" {
		return "", errors.New("not an image")
	}
	st, err := os.Stat(path)
	if err != nil || st.IsDir() {
		return "", errors.New("the image is no longer at " + path)
	}
	if st.Size() > maxPreviewBytes {
		return "", errors.New("the image is too large to preview")
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return "data:" + m + ";base64," + base64.StdEncoding.EncodeToString(b), nil
}
