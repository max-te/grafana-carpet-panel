import Konva from 'konva';
import { useEffect, useInsertionEffect, useState } from 'react';
import { getDevicePixelRatio, type DevicePixelRatioOptions } from 'use-device-pixel-ratio';

export function useKonvaDpr(): number {
  const dpr = useDevicePixelRatio({ round: false, maxDpr: 4, defaultDpr: 2 });
  useInsertionEffect(() => {
    Konva.pixelRatio = Math.ceil(dpr);
  }, [dpr]);
  return dpr;
}

function useDevicePixelRatio(options?: DevicePixelRatioOptions) {
  const dpr = getDevicePixelRatio(options)
  const [currentDpr, setCurrentDpr] = useState(dpr)
  const {defaultDpr, maxDpr, round} = options || {}

  useEffect(() => {
    const canListen = typeof window !== 'undefined' && 'matchMedia' in window
    if (!canListen) {
      console.error('cannot listen to dpr events')
      return
    }

    const updateDpr = () => {
      setCurrentDpr(getDevicePixelRatio({defaultDpr, maxDpr, round}))
    }
    const currentDprLower = Math.trunc(currentDpr * 10) / 10;
    const currentDprUpper = currentDprLower + 0.1;
    const mediaMatcher = globalThis.matchMedia(`screen and (min-resolution: ${currentDprLower.toFixed(1)}dppx) and (max-resolution: ${currentDprUpper.toFixed(1)}dppx)`)
    mediaMatcher.addEventListener('change', updateDpr)

    return () => {
        mediaMatcher.removeEventListener('change', updateDpr)
    }
  }, [currentDpr, defaultDpr, maxDpr, round])

  return currentDpr
}
