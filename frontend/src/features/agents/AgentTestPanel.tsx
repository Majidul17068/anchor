import React, { useState } from 'react';
import type { Agent } from '../../bridge/types';
import { Button } from '../../components/Button';
import { MarkdownView } from '../../components/MarkdownView';
import { CornerDownLeft, Play, X, Bot, RotateCcw } from 'lucide-react';

export interface AgentTestPanelProps {
  agent: Agent;
  onClose: () => void;
}

export const AgentTestPanel: React.FC<AgentTestPanelProps> = ({ agent, onClose }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    {
      role: 'agent',
      text: `Hello! I am **${agent.name}** operating with system instructions for **${agent.modelId}** (${agent.effort} effort). Ask me any test task to verify my tools and attached skills.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    // Simulate response incorporating agent's tools & skills
    setTimeout(() => {
      const toolMention = agent.tools.length > 0 ? ` invoking tool \`${agent.tools[0]}\`` : '';
      const skillMention = agent.skillIds.length > 0 ? ` loaded skill \`${agent.skillIds[0]}\`` : '';
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          text: `[Scratch Test Runner] Executed instructions for **${agent.name}**:${toolMention}${skillMention}.\n\nProcessed: "${userText}"\n\n\`\`\`json\n{\n  "agent": "${agent.id}",\n  "status": "ok",\n  "model": "${agent.modelId}"\n}\n\`\`\``,
        },
      ]);
      setLoading(false);
    }, 700);
  };

  const handleReset = () => {
    setMessages([
      {
        role: 'agent',
        text: `Scratch environment reset for **${agent.name}**. Ready for evaluation.`,
      },
    ]);
  };

  return (
    <div className="w-96 h-full bg-[var(--anchor-surface-elevated)] border-l border-[var(--anchor-border)] flex flex-col overflow-hidden text-left shadow-lg shrink-0 animate-in slide-in-from-right-4 duration-150">
      {/* Header */}
      <div className="h-12 px-4 border-b border-[var(--anchor-border)] flex items-center justify-between bg-[var(--anchor-surface)] shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <Bot className="w-4 h-4 text-[var(--anchor-accent)] shrink-0" />
          <span className="font-semibold text-xs text-[var(--anchor-text)] truncate">
            Test Scratchpad: {agent.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            aria-label="Reset test conversation"
            className="p-1 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] rounded hover:bg-[var(--anchor-surface-hover)]"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'p-2.5 rounded-lg bg-[var(--anchor-accent)] text-white ml-6 text-right'
                : 'p-3 rounded-lg bg-[var(--anchor-surface)] border border-[var(--anchor-border)] text-[var(--anchor-text)] mr-4'
            }
          >
            <MarkdownView content={m.text} />
          </div>
        ))}
        {loading && (
          <div className="p-3 rounded-lg bg-[var(--anchor-surface)] border border-[var(--anchor-border)] text-xs text-[var(--anchor-text-subtle)] flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-[var(--anchor-accent)] border-t-transparent animate-spin" />
            <span>Agent reasoning...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--anchor-border)] bg-[var(--anchor-surface)]">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a test prompt..."
            className="flex-1 bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-[var(--anchor-text)] placeholder-[var(--anchor-text-subtle)] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--anchor-border-focus)]"
          />
          <Button
            size="xs"
            variant="primary"
            disabled={!input.trim() || loading}
            icon={<CornerDownLeft className="w-3.5 h-3.5" />}
            onClick={handleSend}
          >
            Test
          </Button>
        </div>
      </div>
    </div>
  );
};
