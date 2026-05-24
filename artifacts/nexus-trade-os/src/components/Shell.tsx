import { useEffect, useCallback, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useStore, TradeMode } from "@/lib/store";
import { startMockFeed } from "@/lib/mock";
import { api } from "@/lib/api";
import { useWsHub } from "@/hooks/useWsHub";

const TRADE_MODE_LABELS: Record<TradeMode, { label: string; color: string; dot: string; bg: string }> = {
  manual:    { label: "Manuel",   color: "text-slate-400",  dot: "bg-slate-400",  bg: "bg-slate-400/10 border-slate-400/20" },
  semi_auto: { label: "Yarı Oto", color: "text-amber-400",  dot: "bg-amber-400",  bg: "bg-amber-400/10 border-amber-400/20" },
  full_auto: { label: "Tam Oto",  color: "text-emerald-400", dot: "bg-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
};

const NAV_ITEMS = [
  { href: "/",        label: "Dashboard",  icon: DashIcon  },
  { href: "/markets", label: "Piyasalar",  icon: ChartIcon },
  { href: "/trade",   label: "Trade",      icon: TradeIcon },
  { href: "/pnl",     label: "Portföy",    icon: WalletIcon },
  { href: "/agents",  label: "AI Ajanlar", icon: BotIcon   },
];

const MORE_ITEMS = [
  { href: "/risk",           label: "Risk Yönetici",  icon: ShieldIcon  },
  { href: "/orch",           label: "Orkestratör",    icon: ZapIcon     },
  { href: "/admin",          label: "Admin Panel",    icon: SettingsIcon },
  { href: "/admin/exchanges",label: "Borsalar",       icon: LinkIcon    },
  { href: "/admin/strategies",label: "Stratejiler",  icon: BrainIcon   },
  { href: "/admin/telegram", label: "Telegram",       icon: TelegramIcon },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  const {
    token, applyEvent, strongSignal, dismissStrongSignal,
    pendingApprovals, okxConnected, systemConfig, setSystemConfig,
    notifications, dismissNotification,
  } = useStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [moreOpen, setMoreOpen]       = useState(false);
  const [modeSyncing, setModeSyncing] = useState(false);
  const [modeWarning, setModeWarning] = useState<string | null>(null);
  const [darkMode, setDarkMode]       = useState(() => {
    try { return localStorage.getItem("nexus_dark") !== "0"; } catch { return true; }
  });
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tm = TRADE_MODE_LABELS[systemConfig.tradeMode ?? "semi_auto"];

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.classList.toggle("light", !darkMode);
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
      if (e.key === "Escape") { setSidebarOpen(false); setNotifOpen(false); setMoreOpen(false); }
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

  const cycleMode = async () => {
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
  };

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/") || path.startsWith(href + "?");

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] font-sans">

      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-40 h-12 flex items-center px-3 sm:px-4 border-b border-[var(--color-line)] bg-[var(--color-bg-elev)]/95 backdrop-blur-md">

        {/* Left: Logo + hamburger */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="sm:hidden p-1.5 rounded-lg hover:bg-[var(--color-bg-soft)] text-[var(--color-text-dim)] transition"
          >
            <HamburgerIcon />
          </button>
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)] grid place-items-center">
              <span className="text-black font-black text-xs">N</span>
            </div>
            <span className="font-bold text-sm tracking-tight hidden sm:block">
              Nexus<span className="text-[var(--color-accent)]">OS</span>
            </span>
          </Link>

          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--color-bg-soft)] border border-[var(--color-line)]">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${okxConnected ? "bg-[var(--color-up)]" : "bg-[var(--color-text-muted)]"}`} />
            <span className="text-[10px] font-medium text-[var(--color-text-dim)]">
              {okxConnected ? "Canlı" : "Simüle"}
            </span>
          </div>
        </div>

        {/* Center: Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 mx-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                isActive(href)
                  ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-soft)]"
              }`}
            >
              <Icon size={13} active={isActive(href)} />
              {label}
            </Link>
          ))}
          {/* More dropdown */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                moreOpen
                  ? "bg-[var(--color-bg-soft)] text-[var(--color-text)]"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-soft)]"
              }`}
            >
              <DotsIcon size={13} />
              Daha Fazla
            </button>
            {moreOpen && (
              <div className="absolute top-10 left-0 w-48 bg-[var(--color-bg-elev)] border border-[var(--color-line)] rounded-xl shadow-xl z-50 py-1 animate-slide-up">
                {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-soft)] transition"
                  >
                    <Icon size={13} />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Trade Mode */}
          <button
            disabled={modeSyncing}
            onClick={cycleMode}
            className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border font-semibold transition ${
              modeSyncing ? "opacity-50 cursor-wait" : "hover:opacity-80 cursor-pointer"
            } ${tm.bg} ${tm.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${tm.dot} ${modeSyncing ? "animate-spin" : "animate-pulse"}`} />
            <span className="hidden sm:inline">{tm.label}</span>
          </button>

          {/* Pending approvals */}
          {pendingCount > 0 && (
            <Link
              href="/admin/telegram"
              className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 transition font-semibold"
            >
              <span className="w-4 h-4 rounded-full bg-amber-400 text-black text-[9px] grid place-items-center font-black">
                {pendingCount}
              </span>
              <span className="hidden sm:inline">onay</span>
            </Link>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-1.5 rounded-lg bg-[var(--color-bg-soft)] border border-[var(--color-line)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-card)] transition"
            >
              <BellIcon size={14} />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-accent)] text-black text-[9px] grid place-items-center font-black">
                  {unreadNotifs}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-11 w-80 bg-[var(--color-bg-elev)] border border-[var(--color-line)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-up">
                <div className="px-4 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--color-text)]">Bildirimler</span>
                  <button onClick={() => setNotifOpen(false)} className="p-1 rounded-lg hover:bg-[var(--color-bg-soft)] text-[var(--color-text-dim)]">
                    <XIcon size={12} />
                  </button>
                </div>
                <div className="max-h-72 overflow-auto divide-y divide-[var(--color-line)]">
                  {unreadNotifs === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-[var(--color-text-dim)]">Bildirim yok</div>
                  )}
                  {notifications.filter((n) => !n.dismissed).slice(0, 10).map((n) => (
                    <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-[var(--color-bg-soft)] transition">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        n.type === "signal" ? "bg-amber-400"
                        : n.type === "order" ? "bg-[var(--color-up)]"
                        : n.type === "risk"  ? "bg-[var(--color-down)]"
                        : "bg-[var(--color-accent2)]"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[var(--color-text)]">{n.title}</div>
                        <div className="text-[10px] text-[var(--color-text-dim)] mt-0.5 truncate">{n.body}</div>
                        <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5">
                          {new Date(n.ts).toLocaleTimeString("tr-TR")}
                        </div>
                      </div>
                      <button onClick={() => dismissNotification(n.id)} className="p-0.5 rounded hover:bg-[var(--color-line)] text-[var(--color-text-dim)] shrink-0">
                        <XIcon size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode((v) => !v)}
            className="p-1.5 rounded-lg bg-[var(--color-bg-soft)] border border-[var(--color-line)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-card)] transition"
          >
            {darkMode ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          </button>
        </div>
      </header>

      {/* ── Mode Warning Banner ── */}
      {modeWarning && (
        <div className="bg-[var(--color-down)] text-white text-xs text-center py-2 px-4 flex items-center justify-center gap-2 z-30">
          <span>⚡</span>
          <span>{modeWarning}</span>
          <button onClick={() => setModeWarning(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}

      {/* ── Strong Signal Toast ── */}
      {strongSignal && (
        <div className="fixed top-14 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none">
          <div className={`pointer-events-auto w-full max-w-sm rounded-2xl shadow-2xl border px-4 py-3 flex items-start gap-3 animate-slide-down ${
            strongSignal.side === "buy"
              ? "bg-[var(--color-bg-elev)] border-[var(--color-up)]/40"
              : "bg-[var(--color-bg-elev)] border-[var(--color-down)]/40"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 animate-pulse ${
              strongSignal.side === "buy" ? "bg-[var(--color-up)]" : "bg-[var(--color-down)]"
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-[var(--color-text)]">{strongSignal.sym}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-num ${
                  strongSignal.side === "buy" ? "badge-up" : "badge-down"
                }`}>
                  {strongSignal.side.toUpperCase()}
                </span>
                <span className="text-xs font-semibold text-[var(--color-accent)]">
                  %{(strongSignal.strength * 100).toFixed(0)} güven
                </span>
              </div>
              {strongSignal.reason && (
                <div className="text-xs text-[var(--color-text-dim)] mt-0.5 truncate">{strongSignal.reason}</div>
              )}
            </div>
            <button onClick={dismissStrongSignal} className="p-1 rounded-lg hover:bg-[var(--color-bg-soft)] text-[var(--color-text-dim)] shrink-0">
              <XIcon size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 px-3 sm:px-5 max-w-[1440px] mx-auto w-full pt-4 pb-24 md:pb-6">
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-[var(--color-bg-elev)]/95 backdrop-blur-md border-t border-[var(--color-line)]">
        <div className="flex" style={{ height: 58 }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition ${
                  active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)]"
                }`}
              >
                <Icon size={18} active={active} />
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition ${
              sidebarOpen ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            <DotsIcon size={18} />
            Daha
          </button>
        </div>
      </nav>

      {/* ── Mobile Sidebar Drawer ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--color-bg-elev)] border-r border-[var(--color-line)] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-line)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)] grid place-items-center">
                  <span className="text-black font-black text-xs">N</span>
                </div>
                <span className="font-bold text-sm">NexusOS</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-soft)] text-[var(--color-text-dim)]">
                <XIcon size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-0.5">
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider px-3 py-2 font-semibold">Ana Menü</div>
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`sidebar-item ${isActive(href) ? "active" : ""}`}
                >
                  <Icon size={15} active={isActive(href)} />
                  {label}
                </Link>
              ))}
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider px-3 py-2 font-semibold mt-3">Araçlar</div>
              {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`sidebar-item ${isActive(href) ? "active" : ""}`}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(notifOpen || moreOpen) && (
        <div className="fixed inset-0 z-30" onClick={() => { setNotifOpen(false); setMoreOpen(false); }} />
      )}
    </div>
  );
}

/* ── Inline SVG Icons (no icon library dependency) ── */
function DashIcon({ size = 16, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function ChartIcon({ size = 16, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <polyline points="1,12 5,7 8,9 12,4 15,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={active ? "rgba(240,185,11,.15)" : "none"} />
      <line x1="1" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function TradeIcon({ size = 16, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" fill={active ? "rgba(240,185,11,.1)" : "none"} />
      <line x1="5" y1="4" x2="5" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="4" x2="11" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4" y1="11.5" x2="9" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function WalletIcon({ size = 16, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill={active ? "rgba(240,185,11,.1)" : "none"} />
      <path d="M1 7h14" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="10" r="1.2" fill="currentColor" />
      <path d="M4 2h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function BotIcon({ size = 16, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="5" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" fill={active ? "rgba(240,185,11,.1)" : "none"} />
      <circle cx="5.5" cy="9" r="1.2" fill="currentColor" />
      <circle cx="10.5" cy="9" r="1.2" fill="currentColor" />
      <line x1="8" y1="5" x2="8" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="2" r="1" fill="currentColor" />
      <line x1="5" y1="12" x2="11" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1L2 4v4c0 3.3 2.5 6.4 6 7 3.5-.6 6-3.7 6-7V4L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points="5,8 7,10 11,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ZapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <polyline points="9,1 4,9 8,9 7,15 12,7 8,7 9,1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function LinkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M6 8a3 3 0 0 0 4.5.5l2-2a3 3 0 0 0-4.24-4.24l-1.15 1.15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 8a3 3 0 0 0-4.5-.5l-2 2a3 3 0 0 0 4.24 4.24l1.15-1.15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function BrainIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2C5.8 2 4 3.8 4 6c0 .8.2 1.5.6 2.1C3.6 8.6 3 9.7 3 11c0 1.7 1.3 3 3 3h4c1.7 0 3-1.3 3-3 0-1.3-.6-2.4-1.6-2.9.4-.6.6-1.3.6-2.1C12 3.8 10.2 2 8 2z" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M14 2L1 7l5 2 2 5 2-3 4 3L14 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="6" y1="9" x2="9" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function DotsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="13" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}
function HamburgerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1a5 5 0 0 0-5 5v3l-1.5 2h13L13 9V6a5 5 0 0 0-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function SunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3.05" y1="3.05" x2="4.46" y2="4.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11.54" y1="11.54" x2="12.95" y2="12.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12.95" y1="3.05" x2="11.54" y2="4.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4.46" y1="11.54" x2="3.05" y2="12.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
