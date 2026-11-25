package cli

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// The installer is fetched by Anchor itself. A failed or empty download
// must be an error here, not a "finished" install with no binary.
func TestDownloadInstaller(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/ok.sh", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("#!/bin/bash\necho hi\n")) })
	mux.HandleFunc("/empty.sh", func(w http.ResponseWriter, _ *http.Request) {})
	mux.HandleFunc("/html.sh", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("<html>captive portal</html>")) })
	srv := httptest.NewServer(mux)
	defer srv.Close()

	p, err := downloadInstaller(context.Background(), srv.URL+"/ok.sh")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(p)
	if b, _ := os.ReadFile(p); !strings.HasPrefix(string(b), "#!/bin/bash") {
		t.Fatalf("saved script: %q", b)
	}
	for _, bad := range []string{"/empty.sh", "/html.sh", "/missing.sh"} {
		if p, err := downloadInstaller(context.Background(), srv.URL+bad); err == nil {
			os.Remove(p)
			t.Errorf("%s was accepted as an installer", bad)
		}
	}
}
