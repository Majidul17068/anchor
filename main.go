// Anchor — desktop client for Google's Antigravity CLI.
//
// The Go side owns the CLI processes, local metadata, Google Drive sync and
// the marketplace client; the React UI in ./frontend talks to it through the
// methods bound on API (see api.go), which implement the AnchorBridge
// contract from frontend/src/bridge/index.ts.
package main

import (
	"context"
	"embed"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"github.com/Majidul17068/anchor/internal/paths"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

// Version is injected at build time: -ldflags "-X main.Version=v1.2.3".
var Version = "dev"

func main() {
	logger := setupLog()
	api := NewAPI(Version, logger)

	err := wails.Run(&options.App{
		Title:            "Anchor",
		Width:            1320,
		Height:           860,
		MinWidth:         1024,
		MinHeight:        680,
		BackgroundColour: &options.RGBA{R: 0x11, G: 0x12, B: 0x17, A: 255},
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        api.startup,
		OnShutdown:       api.shutdown,
		Bind:             []interface{}{api},
		Mac: &mac.Options{
			TitleBar:   mac.TitleBarHiddenInset(),
			Appearance: mac.DefaultAppearance,
			About: &mac.AboutInfo{
				Title:   "Anchor " + Version,
				Message: "Your Antigravity, anchored to you.\n\nCross-platform desktop client for Google's Antigravity CLI.",
				Icon:    appIcon,
			},
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			BackdropType:         windows.Mica,
		},
		Linux: &linux.Options{
			ProgramName:         "anchor",
			Icon:                appIcon,
			WindowIsTranslucent: false,
		},
	})
	if err != nil {
		logger.Printf("fatal: %v", err)
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func setupLog() *log.Logger {
	_ = paths.EnsureDirs()
	f, err := os.OpenFile(filepath.Join(paths.LogDir(), "anchor.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	var w io.Writer = os.Stderr
	if err == nil {
		if st, serr := f.Stat(); serr == nil && st.Size() > 8<<20 {
			_ = f.Truncate(0)
		}
		w = io.MultiWriter(f, os.Stderr)
	}
	return log.New(w, "", log.LstdFlags|log.Lmsgprefix)
}

var _ = context.Background
