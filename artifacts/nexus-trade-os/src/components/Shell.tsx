import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, LineChart, Cpu, Bot, Settings,
  Plus, X, Command,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { startMockFeed } from "@/lib/mock";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/markets", icon: LineChart, label: "Markets" },
  { href: "/orch", icon: Cpu, label: "Orch" },
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/admin", icon: Settings, label: "Admin" },
];

const FAB_ITEMS = [
  { label: "Hızlı Emir", href: "/trade", icon: "📈" },
  { label: "Ajan Çağır", href: "/agents", icon: "🤖" },
  { label: "Orkestratör", href: "/orch", icon: "⚡" },
  { label: "Risk Yönetici", href: "/risk", icon: "🛡️" },
  { label: "PnL Raporu", href: "/pnl", icon: "💰" },
  { label: "Telegram Ayarı", href: "/admin/telegram", icon: "📱" },
];

const CMD_SHORTCUTS = [
  { label: "Dashboard", q: "home" },
  { label: "Piyasalar", q: "btc" },
  { label: "Orkestratör", q: "orch" },
  { label: "Risk", q: "risk" },
  { label: "PnL", q: "pnl" },
  { label: "Ajanlar", q: "ajan" },
  { label: "Trade", q: "trade" },
  { label: "Telegram", q: "telegram" },
  { label: "Admin", q: "admin" },
  { label: "Borsalar", q: "borsa" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  const { token, applyEvent, pendingApprovals } = useStore();
  const [fabOpen, setFabOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const applyEventStable = useCallback(applyEvent, []);

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

  const pendingCount = pendingApprovals.filter((a) => !a.answer).length;

  return (
    <div className="min-h-dvh pb-20 bg-bg text-text font-sans">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-line">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-text">
              Nexus<span className="text-accent">.</span>
            </span>
            <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
              Trade OS
            </span>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Link href="/admin/telegram" className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition">
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] grid place-items-center font-bold">{pendingCount}</span>
                onay bekliyor
              </Link>
            )}
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 text-text-dim text-sm px-3 py-1.5 rounded-lg bg-bg-elev border border-line hover:bg-bg-soft transition"
            >
              <Command size={13} />
              <span className="hidden sm:inline text-xs">Komut</span>
              <kbd className="text-[10px] bg-bg-soft px-1 rounded border border-line">⌘K</kbd>
            </button>
          </div>
        </div>
      </header>

      <main className="px-3 sm:px-6 max-w-[1400px] mx-auto pt-3">{children}</main>

      <button
        onClick={() => setFabOpen((v) => !v)}
        className="fixed right-5 bottom-24 z-40 w-14 h-14 rounded-full bg-accent shadow-fab grid place-items-center hover:scale-105 transition text-white"
      >
        {fabOpen ? <X size={22} /> : <Plus size={22} />}
      </button>
      {fabOpen && <FabMenu onClose={() => setFabOpen(false)} />}

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-bg-elev border-t border-line shadow-sm">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = path === href || (href !== "/" && path.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center py-2.5 text-[10px] gap-0.5 font-medium transition ${
                  active ? "text-accent" : "text-text-dim hover:text-text"
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

function FabMenu({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  return (
    <div className="fixed inset-0 z-30 bg-black/30" onClick={onClose}>
      <div
        className="absolute right-5 bottom-44 bg-bg-elev border border-line rounded-xl p-2 w-52 shadow-fab"
        onClick={(e) => e.stopPropagation()}
      >
        {FAB_ITEMS.map((item) => (
          <button
            key={item.href}
            onClick={() => { navigate(item.href); onClose(); }}
            className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg hover:bg-bg-soft text-sm text-text transition"
          >
            <span>{item.icon}</span>
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
    if (t.includes("home") || t === "/") navigate("/");
    else if (t.startsWith("btc") || t.includes("piyasa") || t.includes("market")) navigate("/markets");
    else if (t.includes("orch")) navigate("/orch");
    else if (t.includes("risk") || t.includes("shield")) navigate("/risk");
    else if (t.includes("pnl") || t.includes("kâr")) navigate("/pnl");
    else if (t.includes("ajan") || t.includes("agent")) navigate("/agents");
    else if (t.includes("trade") || t.includes("emir")) navigate("/trade");
    else if (t.includes("telegram")) navigate("/admin/telegram");
    else if (t.includes("borsa") || t.includes("exchange")) navigate("/admin/exchanges");
    else if (t.includes("strat")) navigate("/admin/strategies");
    else if (t.includes("admin")) navigate("/admin");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-start pt-20 px-4" onClick={onClose}>
      <div
        className="bg-bg-elev border border-line rounded-xl w-full max-w-xl mx-auto shadow-card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); if (e.key === "Escape") onClose(); }}
          placeholder="Sayfa ara: orch · risk · ajan · borsa · trade..."
          className="w-full bg-transparent px-4 py-3.5 outline-none border-b border-line text-text placeholder:text-text-dim text-sm"
        />
        <div className="p-2 grid grid-cols-3 sm:grid-cols-5 gap-1">
          {CMD_SHORTCUTS.map((hint) => (
            <button
              key={hint.q}
              onClick={() => run(hint.q)}
              className="text-center px-2 py-1.5 rounded-lg hover:bg-bg-soft text-xs text-text-dim hover:text-text transition"
            >
              {hint.label}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-line text-[10px] text-text-dim">
          Enter ile git · Esc ile çık
        </div>
      </div>
    </div>
  );
}

