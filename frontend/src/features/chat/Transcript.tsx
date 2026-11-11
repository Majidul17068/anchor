import React, { useEffect, useRef } from 'react';
import type { Step } from '../../bridge/types';
import { MessageBubble } from './MessageBubble';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';
import { PermissionCard } from './PermissionCard';
import { DiffCard } from './DiffCard';
import { EmptyState } from '../../components/EmptyState';

export interface TranscriptProps {
  sessionId: string;
  steps: Step[];
  isStreaming?: boolean;
}

export const Transcript: React.FC<TranscriptProps> = ({
  sessionId,
  steps,
  isStreaming,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps, isStreaming]);

  if (steps.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <EmptyState
          title="Anchored & Ready"
          description="Send a message, paste a snippet, or use slash commands to start orchestrating with Antigravity CLI."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      {steps.map((step) => {
        if (step.kind === 'user') {
          return (
            <MessageBubble
              key={step.id}
              kind="user"
              text={step.text}
              attachments={step.attachments}
              at={step.at}
            />
          );
        }

        if (step.kind === 'agent') {
          return (
            <MessageBubble
              key={step.id}
              kind="agent"
              markdown={step.markdown}
              at={step.at}
              streaming={step.streaming}
            />
          );
        }

        if (step.kind === 'thinking') {
          return <ThinkingBlock key={step.id} text={step.text} />;
        }

        if (step.kind === 'tool_call') {
          return (
            <ToolCallCard
              key={step.id}
              tool={step.tool}
              args={step.args}
              status={step.status}
              output={step.output}
              durationMs={step.durationMs}
            />
          );
        }

        if (step.kind === 'permission') {
          return (
            <PermissionCard
              key={step.id}
              sessionId={sessionId}
              stepId={step.id}
              tool={step.tool}
              description={step.description}
              resolved={step.resolved}
            />
          );
        }

        if (step.kind === 'diff') {
          return (
            <DiffCard
              key={step.id}
              sessionId={sessionId}
              stepId={step.id}
              path={step.path}
              patch={step.patch}
              accepted={step.accepted}
            />
          );
        }

        return null;
      })}

      <div ref={bottomRef} />
    </div>
  );
};
