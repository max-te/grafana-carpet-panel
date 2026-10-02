import type Konva from 'konva';
import { useEffect } from 'react';

/** Calls onScroll whenever the node's stage container or one of its ancestors scrolls */
export function useAncestorScroll(nodeRef: React.RefObject<Konva.Node | null>, onScroll: () => void) {
  useEffect(() => {
    const listener = (event: Event) => {
      const container = nodeRef.current?.getStage()?.container();
      if (container && event.target instanceof Node && event.target.contains(container)) {
        onScroll();
      }
    };
    // Scroll events do not bubble, so only capturing sees nested scroll containers
    window.addEventListener('scroll', listener, true);
    return () => {
      window.removeEventListener('scroll', listener, true);
    };
  }, [nodeRef, onScroll]);
}
