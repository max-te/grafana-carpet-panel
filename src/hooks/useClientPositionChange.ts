import type Konva from 'konva';
import { useEffect } from 'react';

/** Calls onChange when the node may have moved on screen: an ancestor scrolled or the window resized */
export function useClientPositionChange(nodeRef: React.RefObject<Konva.Node | null>, onChange: () => void) {
  useEffect(() => {
    const handleScroll = (event: Event) => {
      const container = nodeRef.current?.getStage()?.container();
      if (container && event.target instanceof Node && event.target.contains(container)) {
        onChange();
      }
    };
    // Scroll events do not bubble, so only capturing sees nested scroll containers
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onChange);
    };
  }, [nodeRef, onChange]);
}
