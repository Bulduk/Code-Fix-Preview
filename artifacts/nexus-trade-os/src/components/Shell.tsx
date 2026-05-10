"use client";
import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, LineChart, Wallet, Bot, Settings, Plus, X, Command } from "lucide-react";
import { useStore } from "@/lib/store";
import { startMockFeed } from "@/lib/mock";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/markets", icon: LineChart, label: "Markets" },
  { href: "/pnl", icon: Wallet, label: "PnL" },
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/admin", icon: Settings, label: "Admin" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  const { token, applyEvent } = useStore();
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

  return (
    <div className="min-h-dvh pb-20 bg-bg text-text font-sans">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur border-b border-line">
        <div className="flex items-center justify-between px-4 h-12">
          <span className="font-semibold tracking-tight text-text">Nexus<span className="text-accent">.</span></span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 text-text-dim text-sm px-3 py-1.5 rounded-md bg-bg-elev hover:bg-bg-soft transition"
          >
            <Command size={14} />
            <span className="hidden sm:inline">Komut</span>
            <kbd className="text-[10px] bg-bg-soft px-1 rounded">⌘K</kbd>
          </button>
        </div>
      </header>

      <main className="px-3 sm:px-6 max-w-[1400px] mx-auto pt-3">{children}</main>

      <button
        onClick={() => setFabOpen((v) => !v)}
        className="fixed right-5 bottom-24 z-40 w-14 h-14 rounded-full bg-accent text-[#0b0e11] shadow-fab grid place-items-center hover:scale-105 transition"
      >
        {fabOpen ? <X size={22} /> : <Plus size={22} />}
      </button>
      {fabOpen && <FabMenu onClose={() => setFabOpen(false)} />}

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-bg-elev border-t border-line">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = path === href || (href !== "/" && path.startsWith(href));
            return (
              <Link key={href} href={href}>
                <a className={`flex flex-col items-center py-2 text-[11px] gap-0.5 ${active ? "text-accent" : "text-text-dim"}`}>
                  <Icon size={20} />
                  {label}
                </a>
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
  const items = [
    { label: "Hızlı emir", href: "/trade" },
    { label: "Ajan çağır", href: "/agents" },
    { label: "Strateji aç", href: "/admin/strategies" },
    { label: "Borsa ekle", href: "/admin/exchanges" },
  ];
  return (
    <div className="fixed inset-0 z-30 bg-black/50" onClick={onClose}>
      <div
        className="absolute right-5 bottom-44 bg-bg-elev border border-line rounded-xl p-2 w-56 shadow-fab"
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((i) => (
          <button
            key={i.href}
            onClick={() => { navigate(i.href); onClose(); }}
            className="block w-full text-left px-3 py-2 rounded hover:bg-bg-soft text-sm text-text"
          >
            {i.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [, navigate] = useLocation();

  const run = () => {
    const t = q.trim().toLowerCase();
    if (t.startsWith("btc")) navigate("/markets");
    else if (t.includes("pnl")) navigate("/pnl");
    else if (t.includes("ajan") || t.includes("agent")) navigate("/agents");
    else if (t.includes("borsa")) navigate("/admin/exchanges");
    else if (t.includes("strat")) navigate("/admin/strategies");
    else if (t.includes("trade") || t.includes("emir")) navigate("/trade");
    else if (t.includes("admin")) navigate("/admin");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 grid place-items-start pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-elev border border-line rounded-xl w-full max-w-xl mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); if (e.key === "Escape") onClose(); }}
          placeholder="btc · pnl · ajan · borsa · strateji · trade"
          className="w-full bg-transparent px-4 py-3 outline-none border-b border-line text-text placeholder:text-text-dim"
        />
        <div className="px-4 py-2.5 text-text-dim text-xs">Enter ile git · Esc ile çık</div>
        <div className="p-2 border-t border-line grid grid-cols-2 gap-1">
          {[
            { label: "Dashboard", q: "home" },
            { label: "Piyasalar", q: "btc" },
            { label: "PnL", q: "pnl" },
            { label: "Ajanlar", q: "ajan" },
            { label: "Trade", q: "trade" },
            { label: "Admin", q: "admin" },
          ].map((hint) => (
            <button
              key={hint.q}
              onClick={() => { setQ(hint.q); }}
              className="text-left px-3 py-1.5 rounded hover:bg-bg-soft text-xs text-text-dim"
            >
              {hint.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
