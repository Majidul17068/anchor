export function createId(prefix: string = 'id'): string {
  const random = Math.random().toString(36).substring(2, 9);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${random}`;
}

export function truncateMiddle(text: string, maxLen: number = 24): string {
  if (text.length <= maxLen) return text;
  const half = Math.floor((maxLen - 3) / 2);
  return `${text.slice(0, half)}...${text.slice(-half)}`;
}
