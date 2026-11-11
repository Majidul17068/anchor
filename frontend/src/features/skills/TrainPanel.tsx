import React, { useState } from 'react';
import type { Skill, SkillExample } from '../../bridge/types';
import { useSkillsStore } from '../../store/skills';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import {
  CheckCircle2,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { createId } from '../../lib/ids';

export interface TrainPanelProps {
  skill: Skill;
  onUpdateExamples: (examples: SkillExample[]) => void;
}

export const TrainPanel: React.FC<TrainPanelProps> = ({ skill, onUpdateExamples }) => {
  const evaluating = useSkillsStore((s) => s.evaluating);
  const evalResults = useSkillsStore((s) => s.evalResults);
  const evaluateSkill = useSkillsStore((s) => s.evaluateSkill);
  const improveSkill = useSkillsStore((s) => s.improveSkill);

  const [promptInput, setPromptInput] = useState('');
  const [expectedInput, setExpectedInput] = useState('');
  const [improving, setImproving] = useState(false);

  const handleAddExample = () => {
    if (!promptInput.trim() || !expectedInput.trim()) return;
    const newEx: SkillExample = {
      id: createId('ex'),
      prompt: promptInput.trim(),
      expected: expectedInput.trim(),
    };
    onUpdateExamples([...skill.examples, newEx]);
    setPromptInput('');
    setExpectedInput('');
  };

  const handleRemoveExample = (id: string) => {
    onUpdateExamples(skill.examples.filter((e) => e.id !== id));
  };

  const handleRunEvaluation = async () => {
    await evaluateSkill(skill.id);
  };

  const handleImprove = async () => {
    setImproving(true);
    try {
      await improveSkill(skill.id);
    } finally {
      setImproving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6 text-left">
      {/* Top Banner & Actions */}
      <div className="p-4 bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-xl flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-[var(--anchor-text)]">
            Skill Evaluation & Self-Improvement Harness
          </h4>
          <p className="text-xs text-[var(--anchor-text-muted)] mt-0.5">
            Run automated regression prompts through the Antigravity agent. The model will analyze failures to auto-refine SKILL.md.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            loading={improving}
            icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
            onClick={handleImprove}
          >
            Auto-Improve SKILL.md
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={evaluating}
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={handleRunEvaluation}
          >
            Run Evaluation
          </Button>
        </div>
      </div>

      {/* Examples list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
            Test Cases ({skill.examples.length})
          </span>
        </div>

        {skill.examples.length === 0 ? (
          <div className="p-8 border border-dashed border-[var(--anchor-border)] rounded-xl text-center text-xs text-[var(--anchor-text-subtle)]">
            No training examples added yet. Add sample prompts and expected behaviors below to enable regression testing.
          </div>
        ) : (
          <div className="space-y-3">
            {skill.examples.map((ex, index) => {
              const res = evalResults[ex.id] || ex.lastResult;
              return (
                <div
                  key={ex.id}
                  className="p-3 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-xl text-xs space-y-2 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-[var(--anchor-text)]">
                      Case #{index + 1}: &quot;{ex.prompt}&quot;
                    </span>
                    <button
                      onClick={() => handleRemoveExample(ex.id)}
                      aria-label="Remove test case"
                      className="text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-danger)] p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-[11px] text-[var(--anchor-text-muted)] bg-[var(--anchor-surface-sunken)] p-2 rounded border border-[var(--anchor-border-subtle)] font-mono">
                    <span className="text-[var(--anchor-text-subtle)] font-bold block mb-0.5">Expected:</span>
                    {ex.expected}
                  </div>

                  {res && (
                    <div
                      className={`p-2 rounded text-[11px] font-mono flex items-start gap-2 ${
                        res.pass
                          ? 'bg-[var(--anchor-ok-subtle)] text-[var(--anchor-ok)] border border-[var(--anchor-ok)]/20'
                          : 'bg-[var(--anchor-danger-subtle)] text-[var(--anchor-danger)] border border-[var(--anchor-danger)]/20'
                      }`}
                    >
                      {res.pass ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold block">
                          {res.pass ? 'PASSED EVALUATION' : 'FAILED EVALUATION'}
                        </span>
                        <span className="text-[var(--anchor-text)]">{res.output}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add new example form */}
      <div className="p-4 bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] rounded-xl space-y-3">
        <span className="text-xs font-semibold text-[var(--anchor-text)] block">
          Add New Evaluation Test Case
        </span>
        <Input
          placeholder="User input prompt (e.g. 'Refactor useFetch hook to useActionState')"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
        />
        <Input
          placeholder="Expected agent behavior or key code assertion..."
          value={expectedInput}
          onChange={(e) => setExpectedInput(e.target.value)}
        />
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus className="w-3.5 h-3.5" />}
          disabled={!promptInput.trim() || !expectedInput.trim()}
          onClick={handleAddExample}
        >
          Add Test Case
        </Button>
      </div>
    </div>
  );
};
