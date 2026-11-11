import { useEffect, useState } from 'react';

/** Re-renders every `intervalMs` so time-based rules (like the wake-up window) update on screen. */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
