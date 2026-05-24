import { useEffect, useCallback, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, LineChart, Bot, Settings, Plus, X, Command, Zap, Moon, Sun } from "lucide-react";
import { useStore, TradeMode } from "@/lib/store";
import { startMockFeed } from "@/lib/mock";
import { api } from "@/lib/api";
import { useWsHub } from "@/hooks/useWsHub";

const TRADE_MODE_LABELS: Record<TradeMode, { label: string; color: string; short: string }> = {
  manual:    { label: "Manuel",    short: "M",  color: "bg-slate-100 text-slate-600 border-slate-200" },
  semi_auto: { label: "Yarı Oto", short: "SA", color: "bg-amber-100 text-amber-700 border-amber-200" },
  full_auto: { label: "Tam Oto",  short: "FA", color: "bg-green-100 text-green-700 border-green-200" },
};

const LEFT_NAV  = [
  { href: "/",       icon: LayoutDashboard, label: "Home"    },
  { href: "/markets",icon: LineChart,        label: "Markets" },
];
const RIGHT_NAV = [
  { href: "/agents", icon: Bot,      label: "Agents" },
  { href: "/admin",  icon: Settings, label: "Admin"  },
];
const FAB_ITEMS = [
  { label: "Hızlı Emir",      href: "/trade",           icon: "📈" },
  { label: "Orkestratör",     href: "/orch",            icon: "⚡" },
  { label: "Risk Yönetici",   href: "/risk",            icon: "🛡️" },
  { label: "PnL Raporu",      href: "/pnl",             icon: "💰" },
  { label: "Pluginler",       href: "/admin/plugins",   icon: "🔌" },
  { label: "Telegram",        href: "/admin/telegram",  icon: "📱" },
  { label: "Sistem Ayarları", href: "/admin/settings",  icon: "⚙️" },
];
const CMD_SHORTCUTS = [
  { label: "Dashboard",    q: "home"     },
  { label: "Piyasalar",   q: "markets"  },
  { label: "Orkestratör", q: "orch"     },
  { label: "Risk",        q: "risk"     },
  { label: "PnL",         q: "pnl"      },
  { label: "Ajanlar",     q: "agents"   },
  { label: "Trade",       q: "trade"    },
  { label: "Telegram",    q: "telegram" },
  { label: "Borsalar",    q: "exchanges"},
  { label: "Stratejiler", q: "strategies"},
  { label: "Ayarlar",     q: "settings" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  const { token, applyEvent, strongSignal, dismissStrongSignal,
          pendingApprovals, okxConnected, systemConfig, setSystemConfig } = useStore();
  const tm = TRADE_MODE_LABELS[systemConfig.tradeMode ?? "semi_auto"];
  const [fabOpen, setFabOpen]         = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [modeSyncing, setModeSyncing] = useState(false);
  const [modeWarning, setModeWarning] = useState<string | null>(null);
  const [darkMode, setDarkMode]       = useState(() => {
    try { return localStorage.getItem("nexus_dark") === "1"; } catch { return false; }
  });
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try { localStorage.setItem("nexus_dark", darkMode ? "1" : "0"); } catch {}
  }, [darkMode]);

  const applyEventStable = useCallback(applyEvent, []);

  // Connect to backend WS hub (real OKX data + sim ticks from server)
  useWsHub();

  useEffect(() => {
    if (!token) return;
    const stop = startMockFeed();
    return stop;
  }, [token, applyEventStable]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === "Escape") { setPaletteOpen(false); setFabOpen(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // auto-dismiss strong signal after 8s
  useEffect(() => {
    if (!strongSignal) return;
    const t = setTimeout(dismissStrongSignal, 8000);
    return () => clearTimeout(t);
  }, [strongSignal]);

  const pendingCount = pendingApprovals.filter((a) => !a.answer).length;

  return (
    <div className="min-h-dvh pb-24 bg-bg text-text font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-text">
              Nexus<span className="text-accent">.</span>
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
              Trade OS
            </span>
            {okxConnected && (
              <span className="flex items-center gap-1 text-[10px] text-up">
                <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
                OKX Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Trade Mode Cycler — backend sync */}
            <button
              disabled={modeSyncing}
              onClick={async () => {
                const order: TradeMode[] = ["manual","semi_auto","full_auto"];
                const cur  = systemConfig.tradeMode ?? "semi_auto";
                const next = order[(order.indexOf(cur) + 1) % order.length];
                // Optimistic update
                setSystemConfig({ tradeMode: next });
                setModeSyncing(true);
                try {
                  const r = await api.setTradeMode(next);
                  if (r.warning) {
                    setModeWarning(r.warning);
                    if (warnTimer.current) clearTimeout(warnTimer.current);
                    warnTimer.current = setTimeout(() => setModeWarning(null), 5000);
                  }
                } catch { /* optimistic update zaten yapıldı */ }
                finally { setModeSyncing(false); }
              }}
              title="Trade modunu değiştir — backend ile senkronize"
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition ${modeSyncing ? "opacity-50 cursor-wait" : "hover:opacity-80"} ${tm.color}`}
            >
              <Zap size={9} className={modeSyncing ? "animate-spin" : ""} />
              {tm.label}
            </button>
            {pendingCount > 0 && (
              <Link href="/admin/telegram" className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition">
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] grid place-items-center font-bold">{pendingCount}</span>
                onay
              </Link>
            )}
            <button
              onClick={() => setDarkMode((v) => !v)}
              title={darkMode ? "Açık mod" : "Koyu mod"}
              className="p-1.5 rounded-lg bg-bg-elev border border-line text-text-dim hover:bg-bg-soft transition"
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-1.5 text-text-dim text-xs px-3 py-1.5 rounded-lg bg-bg-elev border border-line hover:bg-bg-soft transition"
            >
              <Command size={12} />
              <span className="hidden sm:inline">Komut</span>
              <kbd className="text-[10px] bg-bg-soft px-1 rounded border border-line">⌘K</kbd>
            </button>
          </div>
        </div>

      </header>

      {/* Strong Signal Toast — layout shift yok, her ekranda görünür */}
      {strongSignal && (
        <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none">
          <div className={`pointer-events-auto w-full max-w-sm rounded-2xl shadow-xl border px-4 py-3 flex items-start gap-3 animate-slide-down ${
            strongSignal.side === "buy"
              ? "bg-green-50 border-green-300 text-green-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 animate-pulse ${strongSignal.side === "buy" ? "bg-green-500" : "bg-red-500"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">{strongSignal.sym}</span>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${strongSignal.side === "buy" ? "bg-green-200" : "bg-red-200"}`}>
                  {strongSignal.side.toUpperCase()}
                </span>
                <span className="text-xs font-semibold">%{(strongSignal.strength * 100).toFixed(0)} güven</span>
                <span className="text-xs opacity-70">{strongSignal.ex}</span>
              </div>
              {strongSignal.reason && (
                <div className="text-xs opacity-80 mt-0.5 truncate">{strongSignal.reason}</div>
              )}
            </div>
            <button onClick={dismissStrongSignal} className="p-1 rounded-lg hover:bg-black/10 transition shrink-0 mt-0.5">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Trade Mode Warning Banner */}
      {modeWarning && (
        <div className="bg-red-600 text-white text-xs text-center py-2 px-4 flex items-center justify-center gap-2">
          <Zap size={12} className="shrink-0" />
          <span>{modeWarning}</span>
          <button onClick={() => setModeWarning(null)} className="ml-2 hover:opacity-70">
            <X size={12} />
          </button>
        </div>
      )}

      <main className="px-3 sm:px-5 max-w-[1400px] mx-auto pt-3">{children}</main>

      {/* Bottom Nav — Center FAB design */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-bg-elev border-t border-line shadow-sm">
        <div className="max-w-lg mx-auto relative" style={{ height: 60 }}>
          {/* Left nav items */}
          <div className="absolute left-0 top-0 bottom-0 flex" style={{ width: "calc(50% - 36px)" }}>
            {LEFT_NAV.map(({ href, icon: Icon, label }) => {
              const active = path === href || (href !== "/" && path.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                    active ? "text-accent" : "text-text-dim hover:text-text"
                  }`}
                >
                  <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Center FAB */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-5">
            <button
              onClick={() => setFabOpen((v) => !v)}
              className="w-14 h-14 rounded-full bg-accent text-white shadow-lg shadow-amber-200 flex items-center justify-center hover:scale-105 transition-transform border-4 border-bg-elev"
            >
              <div className={`transition-transform duration-200 ${fabOpen ? "rotate-45" : ""}`}>
                <Plus size={24} />
              </div>
            </button>
          </div>

          {/* Right nav items */}
          <div className="absolute right-0 top-0 bottom-0 flex" style={{ width: "calc(50% - 36px)" }}>
            {RIGHT_NAV.map(({ href, icon: Icon, label }) => {
              const active = path === href || (href !== "/" && path.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                    active ? "text-accent" : "text-text-dim hover:text-text"
                  }`}
                >
                  <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {fabOpen && <FabMenu onClose={() => setFabOpen(false)} />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

function FabMenu({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  return (
    <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose}>
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-28 bg-bg-elev border border-line rounded-2xl p-2 w-56 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] text-text-dim px-3 pt-1 pb-2 uppercase tracking-wider font-medium">Hızlı Erişim</div>
        {FAB_ITEMS.map((item) => (
          <button
            key={item.href}
            onClick={() => { navigate(item.href); onClose(); }}
            className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl hover:bg-bg-soft text-sm text-text transition"
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [, navigate] = useLocation();

  const run = (query?: string) => {
    const t = (query ?? q).trim().toLowerCase();
    if (t.includes("home") || t === "/")              navigate("/");
    else if (t.includes("market"))                    navigate("/markets");
    else if (t.includes("orch"))                      navigate("/orch");
    else if (t.includes("risk"))                      navigate("/risk");
    else if (t.includes("pnl"))                       navigate("/pnl");
    else if (t.includes("agent"))                     navigate("/agents");
    else if (t.includes("trade") || t.includes("emir")) navigate("/trade");
    else if (t.includes("telegram"))                  navigate("/admin/telegram");
    else if (t.includes("exchange") || t.includes("borsa")) navigate("/admin/exchanges");
    else if (t.includes("strat"))                     navigate("/admin/strategies");
    else if (t.includes("plugin") || t.includes("eklenti")) navigate("/admin/plugins");
    else if (t.includes("setting") || t.includes("ayar")) navigate("/admin/settings");
    else if (t.includes("user"))                      navigate("/admin/users");
    else if (t.includes("audit"))                     navigate("/admin/audit");
    else if (t.includes("admin"))                     navigate("/admin");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-start pt-20 px-4" onClick={onClose}>
      <div
        className="bg-bg-elev border border-line rounded-2xl w-full max-w-xl mx-auto shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); if (e.key === "Escape") onClose(); }}
          placeholder="Sayfa ara: orch · risk · market · agents · ayarlar..."
          className="w-full bg-transparent px-4 py-4 outline-none border-b border-line text-text placeholder:text-text-dim text-sm"
        />
        <div className="p-2 grid grid-cols-3 sm:grid-cols-4 gap-1">
          {CMD_SHORTCUTS.map((h) => (
            <button
              key={h.q}
              onClick={() => run(h.q)}
              className="text-center px-2 py-2 rounded-xl hover:bg-bg-soft text-xs text-text-dim hover:text-text transition"
            >
              {h.label}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-line text-[10px] text-text-dim">
          Enter ile git · Esc ile kapat
        </div>
      </div>
    </div>
  );
}
