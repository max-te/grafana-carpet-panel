import { useReducer, useEffect } from 'react';

export function useFontEvents() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    document.fonts.addEventListener('loadingdone', forceUpdate);
    return () => {
      document.fonts.removeEventListener('loadingdone', forceUpdate);
    };
  });
}
