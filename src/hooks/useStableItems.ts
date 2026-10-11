import { useState } from 'react';

/** Keeps the previous array while it holds the same items, so it can serve as a memo dependency. */
export function useStableItems<T>(items: T[]): T[] {
  const [stable, setStable] = useState(items);
  const unchanged = items.length === stable.length && items.every((item, i) => item === stable[i]);
  if (!unchanged) {
    setStable(items);
  }
  return unchanged ? stable : items;
}
