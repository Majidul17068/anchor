import type { ChatEvent, Step } from '../bridge/types';

/**
 * Fold one chat event into a step list. Shared by the main chat store and
 * the agent test panel so both render a turn the same way.
 */
export function applyChatEvent(steps: Step[], event: ChatEvent): Step[] {
  switch (event.type) {
    case 'step':
      return [...steps, event.step];
    case 'step_update':
      return steps.map((s) => (s.id === event.id ? ({ ...s, ...event.patch } as Step) : s));
    case 'token':
      return steps.map((s) =>
        s.id === event.stepId && s.kind === 'agent'
          ? { ...s, markdown: (s.markdown || '') + event.delta }
          : s
      );
    default:
      return steps;
  }
}
