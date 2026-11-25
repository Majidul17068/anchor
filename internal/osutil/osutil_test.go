package osutil

import (
	"runtime"
	"testing"
)

func TestFileURI(t *testing.T) {
	cases := map[string]string{
		"/Users/me/My Files/a b.png": "file:///Users/me/My%20Files/a%20b.png",
		"/tmp/x.txt":                 "file:///tmp/x.txt",
		`C:\Users\me\shot 1.png`:     "file:///C:/Users/me/shot%201.png",
		"C:/Users/me/x.txt":          "file:///C:/Users/me/x.txt",
	}
	for in, want := range cases {
		// Backslash is only a separator on Windows; elsewhere the literal
		// Windows path is tested through its forward-slash form.
		if runtime.GOOS != "windows" && in[1] == ':' && in[2] == '\\' {
			continue
		}
		if got := FileURI(in); got != want {
			t.Errorf("FileURI(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPathFromFileURI(t *testing.T) {
	if p, ok := PathFromFileURI("file:///tmp/a%20b.txt"); !ok || p != "/tmp/a b.txt" && runtime.GOOS != "windows" {
		t.Errorf("got %q %v", p, ok)
	}
	for _, in := range []string{"file:///C:/Users/me/x.txt", "file://C:/Users/me/x.txt"} {
		p, ok := PathFromFileURI(in)
		want := "C:/Users/me/x.txt"
		if runtime.GOOS == "windows" {
			want = `C:\Users\me\x.txt`
		}
		if !ok || p != want {
			t.Errorf("PathFromFileURI(%q) = %q %v, want %q", in, p, ok, want)
		}
	}
	if _, ok := PathFromFileURI("https://example.com/x"); ok {
		t.Error("an https URL was taken for a file")
	}
}

func TestBase(t *testing.T) {
	for in, want := range map[string]string{`C:\Users\me\project`: "project", "/home/me/project/": "project", "project": "project", `D:\work\app\`: "app"} {
		if got := Base(in); got != want {
			t.Errorf("Base(%q) = %q, want %q", in, got, want)
		}
	}
}
