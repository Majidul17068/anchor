import { useState, useCallback } from 'react';

export function useStream() {
  const [isReceiving, setIsReceiving] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);

  const startStream = useCallback(() => {
    setIsReceiving(true);
    setTokenCount(0);
  }, []);

  const addToken = useCallback(() => {
    setTokenCount((c) => c + 1);
  }, []);

  const finishStream = useCallback(() => {
    setIsReceiving(false);
  }, []);

  return { isReceiving, tokenCount, startStream, addToken, finishStream };
}
