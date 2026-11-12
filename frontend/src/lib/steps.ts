import type { ChatEvent, Step } from '../bridge/types';

/**
 * Fold one chat event into a step list. Shared by the main chat store and
 * the agent test panel so both render a turn the same way.
 */
export function applyChatEvent(steps: Step[], event: ChatEvent): Step[] {
  switch (event.type) {
    case 'step':
      return [...steps, event.step];
    case 'step_update': {
      // A patch may only change fields it names. Guard the identity fields
      // regardless of what the producer sent: a patch that carried
      // kind: "" once blanked the agent reply the moment the turn finished.
      const patch: Record<string, unknown> = { ...(event.patch as Record<string, unknown>) };
      for (const k of ['kind', 'id', 'at']) {
        if (patch[k] === '' || patch[k] === undefined || patch[k] === null) delete patch[k];
      }
      return steps.map((s) => (s.id === event.id ? ({ ...s, ...patch } as Step) : s));
    }
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
