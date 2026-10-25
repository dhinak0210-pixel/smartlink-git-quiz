/**
 * Clock Synchronization (NTP-Lite)
 * Calibrates the student client's system clock against the server's clock.
 * Performs 3 round-trips, computing offset = serverTime - clientTime + (roundTrip / 2)
 * and takes the median to eliminate network jitter.
 */

let cachedOffset: number | null = null;

export async function syncClock(): Promise<number> {
  const offsets: number[] = [];

  for (let i = 0; i < 3; i++) {
    const t1 = Date.now();
    try {
      const res = await fetch('/api/clock-sync');
      const t4 = Date.now();
      const { serverTime } = await res.json();

      const roundTrip = t4 - t1;
      const offset = serverTime - t1 - Math.round(roundTrip / 2);
      offsets.push(offset);
    } catch {
      // If one ping fails, fallback to 0 offset
      offsets.push(0);
    }

    if (i < 2) {
      await new Promise((r) => setTimeout(r, 80)); // brief pause between pings
    }
  }

  // Take median
  offsets.sort((a, b) => a - b);
  const medianOffset = offsets[Math.floor(offsets.length / 2)];

  cachedOffset = medianOffset;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('smartlink_clock_offset_ms', medianOffset.toString());
    } catch {
      // Ignore sessionStorage errors
    }
  }

  return medianOffset;
}

export function getStoredClockOffset(): number {
  if (cachedOffset !== null) return cachedOffset;
  if (typeof window !== 'undefined') {
    try {
      const val = sessionStorage.getItem('smartlink_clock_offset_ms');
      if (val !== null) {
        cachedOffset = parseInt(val, 10);
        return cachedOffset;
      }
    } catch {
      // Fall through
    }
  }
  return 0;
}

export function getServerTime(offset: number = getStoredClockOffset()): number {
  return Date.now() + offset;
}
