import React, { useEffect, useRef, useState } from 'react';
import type { Agent, Step } from '../../bridge/types';
import { getBridge } from '../../bridge';
import { useSessionStore } from '../../store/session';
import { applyChatEvent } from '../../lib/steps';
import { Button } from '../../components/Button';
import { Transcript } from '../chat/Transcript';
import { CornerDownLeft, Square, X, Bot, RotateCcw } from 'lucide-react';

export interface AgentTestPanelProps {
  agent: Agent;
  onClose: () => void;
}

/**
 * Runs the agent for real. The first message creates a scratch session in
 * the Antigravity CLI with this agent's model and effort; every reply, tool
 * call and permission prompt streams back through the same path the main
 * chat uses. The scratch session is deleted when the panel closes or resets.
 */
export const AgentTestPanel: React.FC<AgentTestPanelProps> = ({ agent, onClose }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  sessionRef.current = sessionId;

  const discardSession = async (id: string | null) => {
    if (!id) return;
    try {
      await getBridge().sessions.delete(id);
    } catch {
      // Already gone, or the CLI is down; nothing to tidy.
    }
    // The sidebar listed the scratch session while it existed.
    useSessionStore.getState().loadSessions();
  };

  // Tidy the scratch session when the panel unmounts for any reason.
  useEffect(() => {
    return () => {
      void discardSession(sessionRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    const s = await getBridge().sessions.create({
      title: `Test · ${agent.name}`,
      agentId: agent.id,
      modelId: agent.modelId,
      effort: agent.effort,
      mode: 'default',
      workspacePaths: [],
    });
    setSessionId(s.id);
    return s.id;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setError(null);
    setStreaming(true);
    try {
      const id = await ensureSession();
      for await (const ev of getBridge().chat.send(id, text)) {
        if (ev.type === 'error') {
          setError(ev.message);
          break;
        }
        if (ev.type === 'done') break;
        setSteps((prev) => applyChatEvent(prev, ev));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;
    try {
      await getBridge().chat.stop(sessionId);
    } catch {
      // The turn may already have ended.
    }
  };

  const handleReset = async () => {
    const id = sessionId;
    setSessionId(null);
    setSteps([]);
    setError(null);
    await discardSession(id);
  };

  return (
    <div className="w-[28rem] h-full bg-[var(--anchor-surface-elevated)] border-l border-[var(--anchor-border)] flex flex-col overflow-hidden text-left shadow-lg shrink-0 animate-in slide-in-from-right-4 duration-150">
      {/* Header */}
      <div className="h-12 px-4 border-b border-[var(--anchor-border)] flex items-center justify-between bg-[var(--anchor-surface)] shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <Bot className="w-4 h-4 text-[var(--anchor-accent)] shrink-0" />
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold text-xs text-[var(--anchor-text)] truncate">
              Test: {agent.name}
            </span>
            <span className="text-[10px] font-mono text-[var(--anchor-text-subtle)] truncate">
              {agent.modelId} · {agent.effort}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            disabled={streaming}
            aria-label="Reset test conversation"
            className="p-1 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] rounded hover:bg-[var(--anchor-surface-hover)] disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close test panel"
            className="p-1 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] rounded hover:bg-[var(--anchor-surface-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transcript: the same renderer as the main chat */}
      <div className="flex-1 flex flex-col overflow-hidden text-xs">
        {steps.length === 0 && !streaming ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">
              Send a prompt to run <strong className="text-[var(--anchor-text)]">{agent.name}</strong> in a
              scratch session. Tool calls and permission prompts appear here exactly as they would in a
              real chat. The session is discarded when you close this panel.
            </p>
          </div>
        ) : (
          <Transcript sessionId={sessionId ?? ''} steps={steps} isStreaming={streaming} />
        )}
      </div>

      {error && (
        <div className="px-4 py-2 border-t border-[var(--anchor-border)] bg-[var(--anchor-danger)]/10 text-[11px] text-[var(--anchor-danger)]">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-[var(--anchor-border)] bg-[var(--anchor-surface)]">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a test prompt..."
            disabled={streaming}
            className="flex-1 bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-[var(--anchor-text)] placeholder-[var(--anchor-text-subtle)] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--anchor-border-focus)] disabled:opacity-60"
          />
          {streaming ? (
            <Button
              size="xs"
              variant="outline"
              icon={<Square className="w-3 h-3" />}
              onClick={handleStop}
            >
              Stop
            </Button>
          ) : (
            <Button
              size="xs"
              variant="primary"
              disabled={!input.trim()}
              icon={<CornerDownLeft className="w-3.5 h-3.5" />}
              onClick={handleSend}
            >
              Test
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
