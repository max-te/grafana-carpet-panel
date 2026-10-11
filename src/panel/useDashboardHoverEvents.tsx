import { DashboardCursorSync, DataHoverEvent, DataHoverClearEvent } from '@grafana/data';
import { usePanelContext } from '@grafana/ui';
import type Konva from 'konva';
import React, { useCallback, useEffect } from 'react';
import { useClientPositionChange } from '../hooks/useClientPositionChange';
import type { ExternalHover } from '../plot/CarpetPlot';

export const useDashboardHoverEvents = (stageRef: React.RefObject<Konva.Stage | null>) => {
  const { eventBus, sync } = usePanelContext();
  const syncMode = sync ? sync() : DashboardCursorSync.Off;
  const [incomingHover, setIncomingHover] = React.useState<ExternalHover | null>(null);
  const setGlobalHover = useCallback(
    (time: number | null) => {
      if (syncMode !== DashboardCursorSync.Off) {
        if (time) {
          const event = new DataHoverEvent({
            point: { time: time },
          });
          eventBus.publish(event);
        } else {
          eventBus.publish(new DataHoverClearEvent());
        }
      }
    },
    [eventBus, syncMode]
  );
  useEffect(() => {
    const sub = eventBus.getStream(DataHoverEvent).subscribe((ev) => {
      const time = ev.payload.point.time;
      setIncomingHover(
        time
          ? {
            time: time / 1000,
            tooltipOrigin: syncMode === DashboardCursorSync.Tooltip ? getVisibleClientOrigin(stageRef.current) : undefined,
          }
          : null
      );
    });
    return () => {
      sub.unsubscribe();
    };
  }, [eventBus, syncMode, stageRef]);

  useEffect(() => {
    const sub = eventBus.getStream(DataHoverClearEvent).subscribe(() => {
      setIncomingHover(null);
    });
    return () => {
      sub.unsubscribe();
    };
  }, [eventBus]);

  const hideIncomingTooltip = useCallback(() => {
    setIncomingHover((hover) => (hover?.tooltipOrigin ? { time: hover.time } : hover));
  }, []);
  useClientPositionChange(stageRef, hideIncomingTooltip);
  return {
    setGlobalHover,
    incomingHover: syncMode === DashboardCursorSync.Off ? null : incomingHover,
  };
};

// Like Grafana's own panels, show a synced tooltip only while the whole plot is on screen
function getVisibleClientOrigin(stage: Konva.Stage | null) {
  const rect = stage?.container().getBoundingClientRect();
  if (!rect || rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) {
    return undefined;
  }
  return { x: rect.x, y: rect.y };
}
