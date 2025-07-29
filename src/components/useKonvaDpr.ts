import Konva from 'konva';
import React from 'react';
import { useDevicePixelRatio } from 'use-device-pixel-ratio';

export function useKonvaDpr(): number {
  const dpr = Math.ceil(useDevicePixelRatio({ round: false, maxDpr: 4, defaultDpr: 2 }));
  React.useInsertionEffect(() => {
    Konva.pixelRatio = dpr;
  }, [dpr]);
  return dpr;
}
