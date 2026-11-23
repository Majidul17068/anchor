import type { Session } from '../bridge/types';

/**
 * The confirmation shown before deleting a session. Only the parent source
 * (the device that created the chat) can remove it from its original place:
 * on that device a published session also leaves Google Drive. Any other
 * device only drops its own copy and can pull the session again later.
 */
export function deleteSessionMessage(session: Session, thisDeviceId?: string): string {
  const isParent = !thisDeviceId || session.originDeviceId === thisDeviceId;
  const published = session.syncEnabled || session.syncState === 'published' || session.syncState === 'conflict';
  if (isParent && published) {
    return 'This device is the parent source of the session, so it is removed from this device and from your Google Drive. Other devices keep only the copy they already pulled. The Antigravity CLI keeps the conversation and it comes back only if you continue it from the terminal.';
  }
  if (isParent) {
    return 'Removed from Anchor on this device. The Antigravity CLI keeps the conversation and it comes back only if you continue it from the terminal.';
  }
  return 'Only the copy on this device is removed. The device that created the session keeps it, and if it is on Google Drive you can pull it again later.';
}
