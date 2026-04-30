"use client";

import { useEffect, useRef, useState } from "react";

export type SseStatus = "idle" | "connecting" | "open" | "closed" | "error";

/**
 * Subscribe to a server-sent events endpoint and keep the latest payload from
 * each named event.
 *
 * Reconnects automatically with linear backoff on transport errors.
 */
export function useSSE<TEvents extends Record<string, unknown>>(
  url: string | null,
  events: (keyof TEvents)[],
): {
  data: Partial<TEvents>;
  status: SseStatus;
  lastUpdate: number | null;
} {
  const [data, setData] = useState<Partial<TEvents>>({});
  const [status, setStatus] = useState<SseStatus>("idle");
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!url) return;
    let stopped = false;

    function open() {
      setStatus("connecting");
      const es = new EventSource(url!, { withCredentials: true });
      sourceRef.current = es;

      es.onopen = () => {
        retryRef.current = 0;
        setStatus("open");
      };
      es.onerror = () => {
        if (stopped) return;
        setStatus("error");
        es.close();
        const wait = Math.min(15000, 1000 * Math.pow(2, retryRef.current++));
        setTimeout(() => {
          if (!stopped) open();
        }, wait);
      };

      events.forEach((evt) => {
        es.addEventListener(String(evt), (e) => {
          try {
            const parsed = JSON.parse((e as MessageEvent).data);
            setData((prev) => ({ ...prev, [evt]: parsed }));
            setLastUpdate(Date.now());
          } catch {
            // ignore non-JSON
          }
        });
      });
    }

    open();

    return () => {
      stopped = true;
      sourceRef.current?.close();
      setStatus("closed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { data, status, lastUpdate };
}
