/**
 * useWsHub — connects to the backend WS hub (/ws)
 * Receives real OKX ticks + sim ticks from the server.
 * Falls back gracefully if the server is not available.
 */
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";

export function useWsHub() {
  const { applyEvent, setOkxConnected } = useStore();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      // Determine WS URL — same host as the page, port 8080 (api-server)
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      // In Replit, the API server is on port 8080 (mapped to external 8080)
      // In dev, vite proxies /ws to the api-server
      const wsUrl = `${protocol}//${host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          // Connected to backend WS hub
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data as string) as Record<string, unknown>;

            if (msg.type === "okx_status") {
              setOkxConnected(msg.connected as boolean);
              return;
            }

            if (msg.type === "tick") {
              const px = msg.px as number;
              const ex = msg.ex as string;
              const sym = msg.sym as string;
              if (!px || !ex || !sym) return;

              useStore.getState().applyEvent({
                t: "tick",
                ex,
                sym,
                px,
                ts: (msg.ts as number) ?? Date.now(),
                vol24h: msg.vol24h as number | undefined,
                high24h: msg.high24h as number | undefined,
                low24h: msg.low24h as number | undefined,
                change24h: msg.change as number | undefined,
              });
            }
          } catch {
            // ignore malformed
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (mountedRef.current) {
            retryRef.current = setTimeout(connect, 5000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        // WebSocket not available or blocked — silent fallback
        if (mountedRef.current) {
          retryRef.current = setTimeout(connect, 10000);
        }
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);
}
