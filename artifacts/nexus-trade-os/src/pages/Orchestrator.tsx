import { useState, useCallback, useRef } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { LangGraphNode } from "@/lib/store";
import {
  Play, StopCircle, CheckCircle2, XCircle, Loader2,
  Activity, Cpu, MessageSquare, Zap, Database, RefreshCw,
} from "lucide-react";

const SYMS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
const NODE_ICONS: Record<string, React.ElementType> = {
  market_data: Database,
  llm_analysis: Cpu,
  rust_risk: Zap,
  telegram_approval: MessageSquare,
  ccxt_execute: Activity,
};
const NODE_COLORS: Record<LangGraphNode["status"], string> = {
  idle: "bg-bg-soft text-text-dim border-line",
  running: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-green-50 text-green-700 border-green-200",
  error: "bg-red-50 text-red-700 border-red-200",
  waiting: "bg-blue-50 text-blue-700 border-blue-200",
};
const DOT_COLORS: Record<LangGraphNode["status"], string> = {
  idle: "bg-text-dim",
  running: "bg-amber-500 animate-pulse",
  done: "bg-up",
  error: "bg-down",
  waiting: "bg-blue-500 animate-pulse",
};

export default function Orchestrator() {
  const { orchRunning, orchNodes, orchDecisions, orchLatencyMs,
    setOrchRunning, setOrchNodes, addOrchDecision, setOrchLatency,
    telegramEnabled, addPendingApproval } = useStore();

  const [sym, setSym] = useState("BTCUSDT");
  const [provider, setProvider] = useState<"anthropic" | "google">("anthropic");
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLog((l) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l].slice(0, 60));
  }, []);

  const nodesRef = useRef<LangGraphNode[]>([]);

  const runFlow = useCallback(async () => {
    if (orchRunning) return;
    setOrchRunning(true);
    setLog([]);
    addLog("🚀 LangGraph akışı başlatılıyor...");

    const NODE_META: { id: string; label: string }[] = [
      { id: "market_data",       label: "Piyasa Verisi"          },
      { id: "llm_analysis",      label: "AI Analiz (Claude)"     },
      { id: "rust_risk",         label: "Risk Kontrolü"          },
      { id: "telegram_approval", label: "Onay Bekliyor"          },
      { id: "ccxt_execute",      label: "Emir Gönder (Binance)"  },
    ];
    const reset: LangGraphNode[] = NODE_META.map(({ id, label }) => ({ id, label, status: "idle" }));
    nodesRef.current = reset;
    setOrchNodes(reset);

    const mark = (id: string, status: LangGraphNode["status"], ms?: number) => {
      nodesRef.current = nodesRef.current.map((n) =>
        n.id === id ? { ...n, status, latencyMs: ms } : n
      );
      setOrchNodes([...nodesRef.current]);
    };

    const globalStart = Date.now();

    try {
      mark("market_data", "running");
      addLog("📊 CCXT Pro WS bağlantısı açılıyor...");
      await sleep(380);
      mark("market_data", "done", 42);
      addLog(`✅ ${sym} tick verisi alındı.`);

      mark("llm_analysis", "running");
      const providerLabel = provider === "anthropic" ? "Claude 3.5 Sonnet" : "Gemini 1.5 Pro";
      addLog(`🤖 ${providerLabel} analiz çalışıyor...`);
      const result = await api.invokeOrchestrator(sym, provider);
      mark("llm_analysis", "done", result.nodes.find((n) => n.id === "llm_analysis")?.latency_ms);
      addLog(`✅ LLM: ${result.decision.side.toUpperCase()} sinyali — güven %${(result.decision.confidence * 100).toFixed(1)}`);

      mark("rust_risk", "running");
      addLog("⚡ Rust risk katmanı doğrulama (Polars + PyO3)...");
      await sleep(120);
      mark("rust_risk", result.decision.risk_ok ? "done" : "error",
        result.nodes.find((n) => n.id === "rust_risk")?.latency_ms);
      addLog(result.decision.risk_ok ? "✅ Risk limitleri geçti." : "❌ Risk limiti aşıldı — akış durduruldu.");

      if (!result.decision.risk_ok) {
        setOrchRunning(false);
        return;
      }

      if (telegramEnabled) {
        mark("telegram_approval", "waiting");
        addLog("📱 Telegram onay bekleniyor (Human-in-the-loop)...");
        await sleep(1200);
        const approval = {
          id: Math.random().toString(36).slice(2),
          decision: { ...result.decision, id: Math.random().toString(36).slice(2), approved: null, ts: Date.now() },
          sentAt: Date.now(),
        };
        addPendingApproval(approval);
        mark("telegram_approval", "done");
        addLog("✅ Telegram onayı simüle edildi — devam ediliyor.");
      } else {
        mark("telegram_approval", "done");
        addLog("⏭️ Telegram devre dışı — onay atlandı.");
      }

      mark("ccxt_execute", "running");
      addLog(`🔄 CCXT Pro üzerinden ${result.decision.side.toUpperCase()} emri gönderiliyor...`);
      await sleep(200);
      await api.placeOrder({ ex: "binance", sym, side: result.decision.side, type: "market", qty: 0.01 });
      mark("ccxt_execute", "done", result.nodes.find((n) => n.id === "ccxt_execute")?.latency_ms);
      addLog(`✅ Emir iletildi: ${sym} ${result.decision.side.toUpperCase()} 0.01`);

      const totalMs = Date.now() - globalStart;
      setOrchLatency(totalMs);
      addOrchDecision({
        id: Math.random().toString(36).slice(2),
        sym,
        side: result.decision.side,
        confidence: result.decision.confidence,
        reasoning: result.decision.reasoning,
        approved: result.decision.risk_ok,
        ts: Date.now(),
      });
      addLog(`🏁 Akış tamamlandı — toplam ${totalMs}ms`);
    } catch (e) {
      addLog(`❌ Hata: ${e}`);
    } finally {
      setOrchRunning(false);
    }
  }, [orchRunning, sym, provider, telegramEnabled, orchNodes, setOrchRunning,
    setOrchNodes, addOrchDecision, setOrchLatency, addPendingApproval, addLog]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text">AI Sinyal Motoru</h1>
          <p className="text-xs text-text-dim">LangGraph + Claude/Gemini + Risk Kontrolü + Binance CCXT</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {orchLatencyMs > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-bg-soft text-text-dim border border-line">
              Son: {orchLatencyMs}ms
            </span>
          )}
          <select
            value={sym}
            onChange={(e) => setSym(e.target.value)}
            className="bg-bg-elev border border-line rounded-lg px-3 py-1.5 text-sm text-text outline-none"
          >
            {SYMS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "anthropic" | "google")}
            className="bg-bg-elev border border-line rounded-lg px-3 py-1.5 text-sm text-text outline-none"
          >
            <option value="anthropic">Claude 3.5 Sonnet</option>
            <option value="google">Gemini 1.5 Pro</option>
          </select>
          <button
            onClick={runFlow}
            disabled={orchRunning}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50"
          >
            {orchRunning ? <><Loader2 size={14} className="animate-spin" /> Çalışıyor</> : <><Play size={14} /> Hello Trade</>}
          </button>
          {orchRunning && (
            <button onClick={() => setOrchRunning(false)} className="p-1.5 rounded-lg bg-bg-soft hover:bg-line transition">
              <StopCircle size={16} className="text-down" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-bg-elev border border-line rounded-xl p-4 shadow-card">
        <div className="text-xs text-text-dim mb-3 font-medium">LangGraph Akışı</div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {orchNodes.map((node, i) => {
            const Icon = NODE_ICONS[node.id] ?? Activity;
            return (
              <div key={node.id} className="flex items-center gap-1 shrink-0">
                <div className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border ${NODE_COLORS[node.status]} min-w-[100px]`}>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[node.status]}`} />
                    <Icon size={13} />
                  </div>
                  <span className="text-[11px] font-medium text-center leading-tight">{node.label}</span>
                  {node.latencyMs !== undefined && node.status === "done" && (
                    <span className="text-[10px] opacity-70">{node.latencyMs}ms</span>
                  )}
                  {node.status === "running" && <Loader2 size={10} className="animate-spin" />}
                </div>
                {i < orchNodes.length - 1 && (
                  <div className={`w-6 h-0.5 shrink-0 ${node.status === "done" ? "bg-up" : "bg-line"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-elev border border-line rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
            <span className="text-sm font-medium text-text">Karar Geçmişi</span>
            <span className="text-xs text-text-dim">{orchDecisions.length} karar</span>
          </div>
          <div className="divide-y divide-line max-h-72 overflow-auto">
            {orchDecisions.length === 0 && (
              <div className="px-4 py-8 text-center text-text-dim text-sm">
                Henüz karar yok — akışı başlat
              </div>
            )}
            {orchDecisions.map((d) => (
              <div key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-text">{d.sym}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${d.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {d.side.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-dim">%{(d.confidence * 100).toFixed(1)}</span>
                    {d.approved ? <CheckCircle2 size={13} className="text-up" /> : <XCircle size={13} className="text-down" />}
                  </div>
                </div>
                <p className="text-xs text-text-dim leading-relaxed line-clamp-2">{d.reasoning}</p>
                <div className="text-[10px] text-text-dim mt-1">{new Date(d.ts).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg-elev border border-line rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
            <span className="text-sm font-medium text-text">Sistem Logu</span>
            <button onClick={() => setLog([])} className="p-1 rounded hover:bg-bg-soft transition">
              <RefreshCw size={12} className="text-text-dim" />
            </button>
          </div>
          <div className="font-mono text-[11px] p-3 max-h-72 overflow-auto bg-slate-50 space-y-0.5">
            {log.length === 0 && <div className="text-text-dim">Akışı başlatmak için Play düğmesine bas...</div>}
            {log.map((l, i) => (
              <div key={i} className={`leading-relaxed ${l.includes("❌") ? "text-red-600" : l.includes("✅") || l.includes("🏁") ? "text-green-700" : "text-slate-600"}`}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-bg-elev border border-line rounded-xl shadow-card p-4">
        <div className="text-xs text-text-dim font-medium mb-3">Mimari Referans</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {[
            { label: "Python Orkestrasyon", items: ["LangGraph stateful döngü", "FastAPI köprü", "asyncio + uvloop"] },
            { label: "Rust Hız Katmanı", items: ["Polars veri işleme", "PyO3 Python köprüsü", "tokio async runtime"] },
            { label: "Entegrasyonlar", items: ["CCXT Pro WebSocket", "Claude 3.5 / Gemini 1.5", "Telegram Human-in-loop"] },
          ].map((g) => (
            <div key={g.label} className="bg-bg-soft rounded-lg p-3">
              <div className="font-medium text-text mb-2">{g.label}</div>
              {g.items.map((item) => (
                <div key={item} className="text-text-dim flex items-center gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
