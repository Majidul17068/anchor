// anchorctl is a terminal companion to the Anchor desktop app. It drives the
// same engine the UI uses, which makes it handy for diagnostics and scripts:
//
//	anchorctl doctor                 check CLI, account, tier, models
//	anchorctl sessions               list sessions known to Anchor
//	anchorctl chat <id|new> "text"   run one turn and print the stream
//	anchorctl skills | agents        list skills / agents
//	anchorctl sync                   run one Drive sync cycle
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"

	"github.com/Majidul17068/anchor/internal/agents"
	"github.com/Majidul17068/anchor/internal/cli"
	"github.com/Majidul17068/anchor/internal/drive"
	"github.com/Majidul17068/anchor/internal/engine"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/skills"
	"github.com/Majidul17068/anchor/internal/store"
	anchorsync "github.com/Majidul17068/anchor/internal/sync"
)

var Version = "dev"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	st, err := store.New()
	if err != nil {
		log.Fatal(err)
	}
	logf := func(string, ...any) {}
	if os.Getenv("ANCHOR_DEBUG") != "" {
		logf = log.Printf
	}
	loc := cli.NewLocator(st.SettingString("cliPath"))

	var mu sync.Mutex
	events := map[string][]func(any){}
	emit := func(name string, data any) {
		mu.Lock()
		subs := append([]func(any){}, events[name]...)
		mu.Unlock()
		for _, s := range subs {
			s(data)
		}
	}
	on := func(name string, fn func(any)) {
		mu.Lock()
		events[name] = append(events[name], fn)
		mu.Unlock()
	}
	eng := engine.New(loc, st, emit, logf, Version)
	defer eng.Shutdown()

	switch os.Args[1] {
	case "doctor":
		st := loc.Status()
		fmt.Printf("Antigravity CLI: installed=%v path=%s version=%s\n", st.Installed, st.Path, st.Version)
		if acc := eng.AuthStatus(); acc != nil {
			fmt.Printf("Account: %s (%s) plan=%s\n", acc.Name, acc.Email, acc.Plan)
		} else {
			fmt.Println("Account: not signed in")
		}
		if st.Installed {
			if err := eng.Probe(); err != nil {
				fmt.Println("Probe:", err)
			} else if t := eng.Tier(); t != nil {
				fmt.Printf("Tier: %s (%s)\n", t.Name, t.ID)
			}
			models, err := eng.Models()
			if err != nil {
				fmt.Println("Models:", err)
			}
			for _, m := range models {
				fmt.Printf("  model %-22s %s [%s]\n", m.ID, m.Label, m.Family)
			}
		}
	case "sessions":
		list, err := eng.ListSessions()
		if err != nil {
			fmt.Println("warning:", err)
		}
		for _, s := range list {
			fmt.Printf("%s  %-40s  %s  steps=%d sync=%s\n", s.ID, trunc(s.Title, 40), s.LastModified, s.StepCount, s.SyncState)
		}
	case "chat":
		if len(os.Args) < 4 {
			usage()
			os.Exit(2)
		}
		id := os.Args[2]
		text := strings.Join(os.Args[3:], " ")
		if id == "new" {
			cwd, _ := os.Getwd()
			s, err := eng.Create(engine.CreateInput{WorkspacePaths: []string{cwd}, Mode: "auto"})
			if err != nil {
				log.Fatal(err)
			}
			id = s.ID
			fmt.Println("session:", id)
		}
		streamID := "ctl"
		done := make(chan struct{})
		on("chat:"+streamID, func(d any) {
			ev := d.(model.ChatEvent)
			switch ev.Type {
			case "step":
				switch ev.Step.Kind {
				case "user":
					fmt.Printf("\n> %s\n", ev.Step.Text)
				case "agent":
					fmt.Print(ev.Step.Markdown)
				case "thinking":
					fmt.Printf("\n[thinking] %s", trunc(ev.Step.Text, 200))
				case "tool_call":
					args, _ := json.Marshal(ev.Step.Args)
					fmt.Printf("\n[tool %s %s] %s\n", ev.Step.Tool, ev.Step.Status, trunc(string(args), 200))
				case "permission":
					fmt.Printf("\n[permission] %s -> allowing once\n", ev.Step.Description)
					_ = eng.ResolvePermission(id, ev.Step.ID, "once")
				case "diff":
					fmt.Printf("\n[edit %s]\n%s\n", ev.Step.Path, trunc(ev.Step.Patch, 600))
				}
			case "token":
				fmt.Print(ev.Delta)
			case "step_update":
				if ev.Patch != nil && ev.Patch.Status != "" {
					fmt.Printf("\n[tool -> %s]\n", ev.Patch.Status)
				}
			case "error":
				fmt.Printf("\n[error %s] %s\n", ev.Code, ev.Message)
			case "done":
				fmt.Println()
				close(done)
			}
		})
		if _, err := eng.Prompt(id, streamID, text, nil); err != nil {
			log.Fatal(err)
		}
		<-done
	case "skills":
		sk := skills.New(st, eng, func() string { return "me" })
		list, err := sk.List()
		if err != nil {
			log.Fatal(err)
		}
		for _, s := range list {
			fmt.Printf("%-40s %-8s v%-7s %s\n", s.ID, s.Source, s.Version, trunc(s.Description, 70))
		}
	case "agents":
		ag := agents.New(loc)
		list, err := ag.List()
		if err != nil {
			log.Fatal(err)
		}
		for _, a := range list {
			fmt.Printf("%-40s %-8s %s\n", a.ID, a.Source, trunc(a.Description, 70))
		}
	case "sync":
		drv := drive.New(st, func(u string) { fmt.Println("open:", u) }, logf)
		se := anchorsync.New(st, drv, emit, logf)
		status, err := se.SyncNow(context.Background())
		if err != nil {
			fmt.Println("error:", err)
		}
		b, _ := json.MarshalIndent(status, "", "  ")
		fmt.Println(string(b))
	case "version":
		fmt.Println("anchorctl", Version)
	default:
		usage()
		os.Exit(2)
	}
}

func trunc(s string, n int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: anchorctl doctor | sessions | chat <id|new> <text> | skills | agents | sync | version")
}
