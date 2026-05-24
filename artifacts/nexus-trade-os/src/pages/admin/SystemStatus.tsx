/**
 * VPS Sistem Durum Sayfası — /admin/system-status
 * API server sağlığı, DB bağlantısı, exchange durumları, sistem kaynakları
 */
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

type SystemStatus = {
  status: string;
  version: string;
  env: string;
  tradeMode: string;
  uptime: { ms: number; seconds: number; human: string };
  db: { ok: boolean; latencyMs: number };
  exchanges: Array<{
    id: string; exchange: string; label: string; mode: string;
    hasApiKey: boolean; wsConnected: boolean; latencyMs: number | null;
  }>;
  system: {
    platform: string; arch: string; nodeVersion: string;
    memTotal: number; memFree: number; memUsedPct: number;
    loadAvg1m: string; loadAvg5m: string; cpuCount: number;
  };
  ts: number;
};

type Metrics = {
  process: { pid: number; heapUsed: number; heapTotal: number; rss: number; external: number };
  os: { hostname: string; platform: string; release: string; loadAvg: number[]; memTotal: number; memFree: number; uptime: number };
  ts: number;
};

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
      {label ?? (ok ? "OK" : "HATA")}
    </span>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-bg-soft border border-line rounded-xl p-3">
      <div className="text-[10px] text-text-dim mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color ?? "text-text"}`}>{value}</div>
      {sub && <div className="text-[10px] text-text-dim mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SystemStatus() {
  const [status, setStatus]   = useState<SystemStatus | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, m] = await Promise.allSettled([
        fetch("/api/system/status").then((r) => r.json()) as Promise<SystemStatus>,
        fetch("/api/system/metrics", {
          headers: { Authorization: `Bearer ${localStorage.getItem("tok") ?? ""}` },
        }).then((r) => r.json()) as Promise<Metrics>,
      ]);
      if (s.status === "fulfilled") setStatus(s.value);
      else setError("Sistem durumu alınamadı");
      if (m.status === "fulfilled") setMetrics(m.value);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const tradeModeColor = (mode: string) => {
    if (mode === "live") return "text-red-600";
    if (mode === "semi_auto") return "text-amber-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">VPS Sistem Durumu</h1>
          <p className="text-xs text-text-dim">
            {lastRefresh > 0 ? `Son güncelleme: ${new Date(lastRefresh).toLocaleTimeString("tr-TR")}` : "Yükleniyor..."}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "Yükleniyor..." : "Yenile"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {status && (
        <>
          {/* Genel Durum */}
          <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-text">API Server</span>
              <StatusBadge ok={status.status === "ok"} label={status.status === "ok" ? "Çalışıyor" : "Hata"} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Uptime" value={status.uptime.human} sub={`${status.uptime.seconds}sn`} color="text-up" />
              <MetricCard label="Ortam" value={status.env} sub={`v${status.version}`} />
              <MetricCard
                label="Trade Modu"
                value={status.tradeMode}
                color={tradeModeColor(status.tradeMode)}
              />
              <MetricCard
                label="DB Bağlantısı"
                value={status.db.ok ? `${status.db.latencyMs}ms` : "HATA"}
                color={status.db.ok ? "text-up" : "text-down"}
                sub={status.db.ok ? "PostgreSQL" : "Bağlantı yok"}
              />
            </div>
          </div>

          {/* Sistem Kaynakları */}
          <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
            <div className="text-sm font-semibold text-text mb-3">Sistem Kaynakları</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="RAM Kullanımı"
                value={`%${status.system.memUsedPct}`}
                sub={`${status.system.memTotal - status.system.memFree}MB / ${status.system.memTotal}MB`}
                color={status.system.memUsedPct > 85 ? "text-down" : status.system.memUsedPct > 70 ? "text-amber-600" : "text-up"}
              />
              <MetricCard
                label="CPU Yük (1m)"
                value={status.system.loadAvg1m}
                sub={`${status.system.cpuCount} çekirdek`}
                color={parseFloat(status.system.loadAvg1m) > status.system.cpuCount ? "text-down" : "text-up"}
              />
              <MetricCard label="CPU Yük (5m)" value={status.system.loadAvg5m} />
              <MetricCard label="Node.js" value={status.system.nodeVersion} sub={`${status.system.platform}/${status.system.arch}`} />
            </div>

            {/* RAM progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-text-dim mb-1">
                <span>RAM</span>
                <span>{status.system.memTotal - status.system.memFree}MB / {status.system.memTotal}MB</span>
              </div>
              <div className="h-2 bg-bg-soft rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    status.system.memUsedPct > 85 ? "bg-red-500" :
                    status.system.memUsedPct > 70 ? "bg-amber-400" : "bg-up"
                  }`}
                  style={{ width: `${status.system.memUsedPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Exchange Durumları */}
          <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
            <div className="px-4 py-2.5 border-b border-line">
              <span className="text-sm font-semibold text-text">Exchange Bağlantıları</span>
            </div>
            <div className="divide-y divide-line">
              {status.exchanges.map((ex) => (
                <div key={ex.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-bg-soft border border-line grid place-items-center text-xs font-bold text-text-dim uppercase">
                      {ex.exchange.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text capitalize">{ex.exchange}</div>
                      <div className="text-[10px] text-text-dim">{ex.label} · {ex.mode}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ex.latencyMs !== null && (
                      <span className="text-xs font-mono text-text-dim">{ex.latencyMs}ms</span>
                    )}
                    <StatusBadge ok={ex.hasApiKey} label={ex.hasApiKey ? "API Key ✓" : "Paper"} />
                    <StatusBadge ok={ex.wsConnected} label={ex.wsConnected ? "WS Bağlı" : "WS Yok"} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Process Metrikleri */}
      {metrics && (
        <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
          <div className="text-sm font-semibold text-text mb-3">Process Metrikleri</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Heap Kullanım" value={`${metrics.process.heapUsed}MB`} sub={`/ ${metrics.process.heapTotal}MB`} />
            <MetricCard label="RSS" value={`${metrics.process.rss}MB`} sub="Resident Set Size" />
            <MetricCard label="PID" value={metrics.process.pid} />
            <MetricCard label="OS Uptime" value={`${Math.floor(metrics.os.uptime / 3600)}s`} sub={metrics.os.hostname} />
          </div>
        </div>
      )}

      {/* VPS Bağlantı Bilgisi */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="text-sm font-semibold text-blue-800 mb-2">🖥️ VPS Bilgileri</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-blue-700">
          <div><span className="font-medium">IP:</span> 76.13.151.158</div>
          <div><span className="font-medium">Coolify Panel:</span> <a href="http://76.13.151.158:8000" target="_blank" rel="noreferrer" className="underline">:8000</a></div>
          <div><span className="font-medium">API:</span> /api/*</div>
          <div><span className="font-medium">WebSocket:</span> /ws</div>
        </div>
      </div>
    </div>
  );
}
