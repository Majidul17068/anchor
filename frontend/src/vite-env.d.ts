/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Window {
  /** Wails v2 bindings (present only inside the desktop shell). */
  go?: { main?: { API?: Record<string, (...args: unknown[]) => Promise<unknown>> } };
  /** Wails v2 runtime (present only inside the desktop shell). */
  runtime?: {
    EventsOn: (name: string, cb: (data: unknown) => void) => () => void;
    EventsOff: (name: string) => void;
    BrowserOpenURL: (url: string) => void;
    Quit: () => void;
    WindowMinimise: () => void;
    WindowToggleMaximise: () => void;
  };
}
