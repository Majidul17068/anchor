import { useEffect } from 'react';

export interface ShortcutOptions {
  ctrlOrMeta?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
}

export function useShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const modifierMatch = options.ctrlOrMeta ? (isMac ? e.metaKey : e.ctrlKey) : true;
      const shiftMatch = options.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = options.alt ? e.altKey : !e.altKey;

      if (e.key.toLowerCase() === key.toLowerCase() && modifierMatch && shiftMatch && altMatch) {
        if (options.preventDefault !== false) {
          e.preventDefault();
        }
        handler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, handler, options]);
}
