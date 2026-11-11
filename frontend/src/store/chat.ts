import { create } from 'zustand';
import type { Attachment, Step } from '../bridge/types';
import { getBridge } from '../bridge';

export interface InspectorContent {
  type: 'tool' | 'diff' | 'permission' | 'skill' | 'device';
  title: string;
  data: any;
}

interface ChatState {
  steps: Step[];
  isStreaming: boolean;
  activeStepId: string | null;
  inspectorContent: InspectorContent | null;
  error: string | null;

  loadSteps: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, text: string, attachments?: Attachment[]) => Promise<void>;
  stopStreaming: (sessionId: string) => Promise<void>;
  resolvePermission: (sessionId: string, stepId: string, decision: 'once' | 'always' | 'deny') => Promise<void>;
  resolveDiff: (sessionId: string, stepId: string, accept: boolean) => Promise<void>;
  openInspector: (content: InspectorContent) => void;
  closeInspector: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  steps: [],
  isStreaming: false,
  activeStepId: null,
  inspectorContent: null,
  error: null,

  loadSteps: async (sessionId: string) => {
    try {
      const bridge = getBridge();
      const res = await bridge.sessions.get(sessionId);
      set({ steps: res.steps, error: null });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load conversation steps' });
    }
  },

  sendMessage: async (sessionId: string, text: string, attachments?: Attachment[]) => {
    if (get().isStreaming) return;

    try {
      set({ isStreaming: true, error: null });
      const bridge = getBridge();
      const stream = bridge.chat.send(sessionId, text, attachments);

      for await (const event of stream) {
        if (event.type === 'step') {
          set((state) => ({
            steps: [...state.steps, event.step],
            activeStepId: event.step.id,
          }));
        } else if (event.type === 'step_update') {
          set((state) => ({
            steps: state.steps.map((s) => (s.id === event.id ? ({ ...s, ...event.patch } as Step) : s)),
          }));
        } else if (event.type === 'token') {
          set((state) => ({
            steps: state.steps.map((s) => {
              if (s.id === event.stepId && s.kind === 'agent') {
                return { ...s, markdown: (s.markdown || '') + event.delta };
              }
              return s;
            }),
          }));
        } else if (event.type === 'done') {
          set({ isStreaming: false, activeStepId: null });
        } else if (event.type === 'error') {
          set({ error: event.message, isStreaming: false });
        }
      }
    } catch (err: any) {
      set({ error: err.message || 'Error communicating with Antigravity CLI', isStreaming: false });
    } finally {
      set({ isStreaming: false, activeStepId: null });
    }
  },

  stopStreaming: async (sessionId: string) => {
    try {
      const bridge = getBridge();
      await bridge.chat.stop(sessionId);
      set({ isStreaming: false });
    } catch {
      set({ isStreaming: false });
    }
  },

  resolvePermission: async (sessionId: string, stepId: string, decision: 'once' | 'always' | 'deny') => {
    const bridge = getBridge();
    await bridge.chat.resolvePermission(sessionId, stepId, decision);
    set((state) => ({
      steps: state.steps.map((s) => (s.id === stepId && s.kind === 'permission' ? { ...s, resolved: decision } : s)),
    }));
  },

  resolveDiff: async (sessionId: string, stepId: string, accept: boolean) => {
    const bridge = getBridge();
    await bridge.chat.resolveDiff(sessionId, stepId, accept);
    set((state) => ({
      steps: state.steps.map((s) => (s.id === stepId && s.kind === 'diff' ? { ...s, accepted: accept } : s)),
    }));
  },

  openInspector: (content: InspectorContent) => {
    set({ inspectorContent: content });
  },

  closeInspector: () => {
    set({ inspectorContent: null });
  },
}));
