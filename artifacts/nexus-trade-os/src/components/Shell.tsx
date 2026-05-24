import { useEffect, useCallback, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, LineChart, Bot, Settings, Plus, X,
  Moon, Sun, Bell, TrendingUp, DollarSign, Shield, Zap,
} from "lucide-react";
import { useStore, TradeMode } from "@/lib/store";
import { startMockFeed } from "@/lib/mock";
import { api } from "@/lib/api";
import { useWsHub } from "@/hooks/useWsHub";

const TRADE_MODE_LABELS: Record<TradeMode, { label: string; color: string; dot: string }> = {
  manual:    { label: "Manuel",    color: "bg-slate-100 text-slate-600 border-slate-200",  dot: "bg-slate-400" },
  semi_auto: { label: "Yarı Oto", color: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-500" },
  full_auto: { label: "Tam Oto",  color: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500" },
};

// 5 tab — FAB yok, Binance tarzı
const NAV_ITEMS = [
  { href: "/",        icon: LayoutDashboard, label: "Ana Sayfa" },
  { href: "/markets", icon: LineChart,        label: "Piyasalar" },
  { href: "/trade",   icon: TrendingUp,       label: "Trade"    },
  { href: "/pnl",     icon: DollarSign,       label: "Portföy"  },
  { href: "/agents",  icon: Bot,              label: "Ajanlar"  },
];

const FAB_ITEMS = [
  { label: "Risk Yönetici",   href: "/risk",                    icon: "🛡️" },
  { label: "Orkestratör",     href: "/orch",                    icon: "⚡" },
  { label: "Pluginler",       href: "/admin/plugins",           icon: "🔌" },
  { label: "Telegram",        href: "/admin/telegram",          icon: "📱" },
  { label: "Sistem Ayarları", href: "/admin/settings",          icon: "⚙️" },
  { label: "VPS Durumu",      href: "/admin/system-status",     icon: "🖥️" },
  { label: "Admin",           href: "/admin",                   icon: "🔧" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  const {
    token, applyEvent, strongSignal, dismissStrongSignal,
    pendingApprovals, okxConnected, systemConfig, setSystemConfig,
    notifications, dismissNotification,
  } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const tm = TRADE_MODE_LABELS[systemConfig.tradeMode ?? "semi_auto"];
  const [fabOpen, setFabOpen]     = useState(false);
  const [modeSyncing, setModeSyncing] = useState(false);
  const [modeWarning, setModeWarning] = useState<string | null>(null);
  const [darkMode, setDarkMode]   = useState(() => {
    try { return localStorage.getItem("nexus_dark") === "1"; } catch { return false; }
  });
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try { localStorage.setItem("nexus_dark", darkMode ? "1" : "0"); } catch {}
  }, [darkMode]);

  const applyEventStable = useCallback(applyEvent, []);

  useWsHub();

  useEffect(() => {
    if (!token) return;
    const stop = startMockFeed();
    return stop;
  }, [token, applyEventStable]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setFabOpen(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (!strongSignal) return;
    const t = setTimeout(dismissStrongSignal, 8000);
    return () => clearTimeout(t);
  }, [strongSignal]);

  const pendingCount = pendingApprovals.filter((a) => !a.answer).length;
  const unreadNotifs = notifications.filter((n) => !n.dismissed).length;

  return (
    <div className="min-h-dvh pb-20 bg-bg text-text font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line">
        <div className="flex items-center justify-between px-4 h-12 max-w-[1400px] mx-auto">
          {/* Sol: Logo + Binance badge */}
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-text text-base">
              Nexus<span className="text-accent">.</span>
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 font-semibold">
              Binance
            </span>
            {/* Binance Live göstergesi */}
            {okxConnected && (
              <span className="flex items-center gap-1 text-[10px] text-up font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
                <span className="hidden sm:inline">Binance Live</span>
                <span className="sm:hidden">Live</span>
              </span>
            )}
          </div>

          {/* Orta: Spot / Futures / Margin sekmeleri (sm+) */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: "Spot",    href: "/markets" },
              { label: "Futures", href: "/markets?tab=perp" },
              { label: "Margin",  href: "/markets?tab=margin" },
            ].map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  path === "/markets" && t.label === "Spot"
                    ? "bg-accent/10 text-accent"
                    : "text-text-dim hover:text-text hover:bg-bg-soft"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {/* Sağ: Trade mode + bakiye özeti + bildirim + dark */}
          <div className="flex items-center gap-2">
            {/* Trade Mode Cycler */}
            <button
              disabled={modeSyncing}
              onClick={async () => {
                const order: TradeMode[] = ["manual", "semi_auto", "full_auto"];
                const cur  = systemConfig.tradeMode ?? "semi_auto";
                const next = order[(order.indexOf(cur) + 1) % order.length];
                setSystemConfig({ tradeMode: next });
                setModeSyncing(true);
                try {
                  const r = await api.setTradeMode(next);
                  if (r.warning) {
                    setModeWarning(r.warning);
                    if (warnTimer.current) clearTimeout(warnTimer.current);
                    warnTimer.current = setTimeout(() => setModeWarning(null), 5000);
                  }
                } catch { /* optimistic */ }
                finally { setModeSyncing(false); }
              }}
              title="Trade modunu değiştir"
              className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border font-semibold transition ${
                modeSyncing ? "opacity-50 cursor-wait" : "hover:opacity-80"
              } ${tm.color}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tm.dot} ${modeSyncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{tm.label}</span>
              <span className="sm:hidden">{tm.label.slice(0, 1)}</span>
            </button>

            {/* Onay bekleyen */}
            {pendingCount > 0 && (
              <Link
                href="/admin/telegram"
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition"
              >
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] grid place-items-center font-bold">
                  {pendingCount}
                </span>
                <span className="hidden sm:inline">onay</span>
              </Link>
            )}

            {/* Bildirim */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-1.5 rounded-lg bg-bg-elev border border-line text-text-dim hover:bg-bg-soft transition"
                title="Bildirimler"
              >
                <Bell size={14} />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-white text-[9px] grid place-items-center font-bold">
                    {unreadNotifs}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 w-72 bg-bg-elev border border-line rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-line flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">Bildirimler</span>
                    <button onClick={() => setNotifOpen(false)} className="p-0.5 rounded hover:bg-bg-soft text-text-dim">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="max-h-64 overflow-auto divide-y divide-line">
                    {unreadNotifs === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-text-dim">Bildirim yok</div>
                    )}
                    {notifications
                      .filter((n) => !n.dismissed)
                      .slice(0, 10)
                      .map((n) => (
                        <div key={n.id} className="px-3 py-2.5 flex items-start gap-2 hover:bg-bg-soft transition">
                          <div
                            className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                              n.type === "signal" ? "bg-amber-500"
                              : n.type === "order" ? "bg-up"
                              : n.type === "risk"  ? "bg-down"
                              : "bg-accent"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-text">{n.title}</div>
                            <div className="text-[10px] text-text-dim mt-0.5 truncate">{n.body}</div>
                            <div className="text-[9px] text-text-dim mt-0.5">
                              {new Date(n.ts).toLocaleTimeString("tr-TR")}
                            </div>
                          </div>
                          <button
                            onClick={() => dismissNotification(n.id)}
                            className="p-0.5 rounded hover:bg-line text-text-dim shrink-0"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dark mode */}
            <button
              onClick={() => setDarkMode((v) => !v)}
              title={darkMode ? "Açık mod" : "Koyu mod"}
              className="p-1.5 rounded-lg bg-bg-elev border border-line text-text-dim hover:bg-bg-soft transition"
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Admin / Ayarlar — sadece desktop */}
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-1 p-1.5 rounded-lg bg-bg-elev border border-line text-text-dim hover:bg-bg-soft transition"
              title="Admin"
            >
              <Settings size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Strong Signal Toast */}
      {strongSignal && (
        <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none">
          <div
            className={`pointer-events-auto w-full max-w-sm rounded-2xl shadow-xl border px-4 py-3 flex items-start gap-3 animate-slide-down ${
              strongSignal.side === "buy"
                ? "bg-green-50 border-green-300 text-green-900"
                : "bg-red-50 border-red-300 text-red-900"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 animate-pulse ${
                strongSignal.side === "buy" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">{strongSignal.sym}</span>
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                    strongSignal.side === "buy" ? "bg-green-200" : "bg-red-200"
                  }`}
                >
                  {strongSignal.side.toUpperCase()}
                </span>
                <span className="text-xs font-semibold">
                  %{(strongSignal.strength * 100).toFixed(0)} güven
                </span>
                <span className="text-xs opacity-70">{strongSignal.ex}</span>
              </div>
              {strongSignal.reason && (
                <div className="text-xs opacity-80 mt-0.5 truncate">{strongSignal.reason}</div>
              )}
            </div>
            <button
              onClick={dismissStrongSignal}
              className="p-1 rounded-lg hover:bg-black/10 transition shrink-0 mt-0.5"
            >
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

      {/* ── Bottom Nav — 5 tab, FAB yok ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-bg-elev border-t border-line shadow-sm">
        <div className="max-w-lg mx-auto flex" style={{ height: 60 }}>
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active =
              href === "/"
                ? path === "/"
                : path === href || path.startsWith(href + "?") || path.startsWith(href + "/");
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
          {/* Daha Fazla — FAB yerine */}
          <button
            onClick={() => setFabOpen((v) => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
              fabOpen ? "text-accent" : "text-text-dim hover:text-text"
            }`}
          >
            <Plus size={19} strokeWidth={fabOpen ? 2.5 : 1.8} className={fabOpen ? "rotate-45 transition-transform" : "transition-transform"} />
            Daha Fazla
          </button>
        </div>
      </nav>

      {fabOpen && <FabMenu onClose={() => setFabOpen(false)} />}
    </div>
  );
}

function FabMenu({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  return (
    <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose}>
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-16 bg-bg-elev border border-line rounded-2xl p-2 w-52 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] text-text-dim px-3 pt-1 pb-2 uppercase tracking-wider font-medium">
          Hızlı Erişim
        </div>
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
