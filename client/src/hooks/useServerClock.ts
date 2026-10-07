import { useEffect, useState } from "react";

/** Anchors serverNow to a monotonic browser clock so interval renders don't recalibrate/jump. */
export function useServerClock(serverNow?: string | null) {
  const [tick, setTick] = useState(0);
  const [anchor, setAnchor] = useState<{ server: number; monotonic: number } | null>(null);
  useEffect(() => {
    if (!serverNow) return;
    const server = new Date(serverNow).getTime();
    if (Number.isFinite(server)) setAnchor({ server, monotonic: performance.now() });
  }, [serverNow]);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return anchor ? anchor.server + (performance.now() - anchor.monotonic) : Date.now() + tick * 0;
}
