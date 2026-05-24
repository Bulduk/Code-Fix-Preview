/**
 * useWsHub — backend WS hub'a bağlanır (/ws)
 * Gerçek OKX tick'leri + sunucudan sim tick'ler alır.
 * VPS'te nginx /ws → api:8080/ws proxy'si üzerinden çalışır.
 */
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";

export function useWsHub() {
  const { setOkxConnected } = useStore();
  const wsRef    = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      // Aynı host üzerinden /ws — nginx proxy veya vite dev proxy halleder
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl    = `${protocol}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          // Bağlandı — ping/pong başlat
          const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 30000);
          (ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> })._pingInterval = pingInterval;
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data as string) as Record<string, unknown>;

            if (msg.type === "okx_status") {
              setOkxConnected(msg.connected as boolean);
              return;
            }

            if (msg.type === "pong") return;

            if (msg.type === "tick") {
              const px  = msg.px  as number;
              const ex  = msg.ex  as string;
              const sym = msg.sym as string;
              if (!px || !ex || !sym) return;

              useStore.getState().applyEvent({
                t:        "tick",
                ex,
                sym,
                px,
                ts:       (msg.ts as number) ?? Date.now(),
                vol24h:   msg.vol24h  as number | undefined,
                high24h:  msg.high24h as number | undefined,
                low24h:   msg.low24h  as number | undefined,
                change24h: msg.change as number | undefined,
              });
              return;
            }

            // Sunucudan gelen sinyal broadcast
            if (msg.type === "signal") {
              useStore.getState().applyEvent({
                t:        "signal",
                id:       msg.id as string,
                strategy: msg.strategy as string,
                ex:       msg.ex as string,
                sym:      msg.sym as string,
                side:     msg.side as string,
                strength: msg.strength as number,
                reason:   msg.reason as string | undefined,
                market:   msg.market as string | undefined,
                ts:       (msg.ts as number) ?? Date.now(),
              });
              return;
            }

            // Sunucudan gelen PnL güncelleme
            if (msg.type === "pnl") {
              const store = useStore.getState();
              store.applyEvent({
                t:          "pnl",
                equity:     msg.equity as number,
                realized:   msg.realized as number,
                unrealized: msg.unrealized as number,
              });
              // PnL history'ye de ekle
              store.pushPnlHistory({
                ts:         (msg.ts as number) ?? Date.now(),
                equity:     msg.equity as number,
                realized:   msg.realized as number,
                unrealized: msg.unrealized as number,
              });
              return;
            }
          } catch {
            // malformed mesaj — yoksay
          }
        };

        ws.onclose = () => {
          const typed = ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> };
          if (typed._pingInterval) clearInterval(typed._pingInterval);
          wsRef.current = null;
          if (mountedRef.current) {
            retryRef.current = setTimeout(connect, 5000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        // WebSocket desteklenmiyor veya engellendi — sessiz fallback
        if (mountedRef.current) {
          retryRef.current = setTimeout(connect, 10000);
        }
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);
}
