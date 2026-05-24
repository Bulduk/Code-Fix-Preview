import { Link } from "wouter";
import {
  Server, BarChart2, Users, FileText, MessageSquare,
  Shield, Settings, Anchor, Monitor,
} from "lucide-react";
import { useStore } from "@/lib/store";

const cards = [
  { href: "/admin/exchanges",      title: "Borsalar",        desc: "Spot/Futures/Perp — CCXT Pro, edit & test",         icon: Server,       color: "bg-blue-100 text-blue-700"   },
  { href: "/admin/strategies",     title: "Stratejiler",     desc: "Kod editörü, SL/TP, LLM, borsa atama",             icon: BarChart2,     color: "bg-purple-100 text-purple-700"},
  { href: "/agents",               title: "AI Ajanlar",      desc: "Claude · Gemini · GPT · Nautilus — LangGraph",     icon: Anchor,        color: "bg-teal-100 text-teal-700"   },
  { href: "/risk",                 title: "Risk Yöneticisi", desc: "Pozisyon limitleri, Rust engine doğrulama",          icon: Shield,        color: "bg-red-100 text-red-700"     },
  { href: "/admin/telegram",       title: "Telegram",        desc: "Human-in-the-loop onay mekanizması",               icon: MessageSquare, color: "bg-sky-100 text-sky-700"     },
  { href: "/admin/settings",       title: "Sistem Ayarları", desc: "LLM, gecikme, paper trading, ilk kurulum",          icon: Settings,      color: "bg-amber-100 text-amber-700" },
  { href: "/admin/users",          title: "Kullanıcılar",    desc: "RBAC rolleri, 2FA, erişim yönetimi",                icon: Users,         color: "bg-orange-100 text-orange-700"},
  { href: "/admin/audit",          title: "Audit Log",       desc: "Sistem aksiyonları ve değişiklik geçmişi",          icon: FileText,      color: "bg-slate-100 text-slate-700" },
  { href: "/admin/system-status",  title: "VPS Durumu",      desc: "API sağlığı, DB, RAM, CPU, exchange bağlantıları",  icon: Monitor,       color: "bg-green-100 text-green-700" },
];

export default function Admin() {
  const { systemConfig } = useStore();

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-text">Admin Paneli</h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-text-dim">Nexus Trade OS</span>
          {systemConfig.paperTrading && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 font-medium">
              Paper Mod
            </span>
          )}
          {systemConfig.firstRunDone ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">
              ✓ Yapılandırıldı
            </span>
          ) : (
            <Link href="/admin/settings" className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium hover:bg-amber-200 transition">
              ⚠ İlk Kurulum Gerekli →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="bg-bg-elev border border-line rounded-2xl p-4 hover:shadow-md transition flex gap-3 items-start shadow-card"
          >
            <div className={`w-9 h-9 rounded-xl grid place-items-center mt-0.5 shrink-0 ${c.color}`}>
              <c.icon size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-text text-sm">{c.title}</div>
              <div className="text-text-dim text-xs mt-0.5 leading-relaxed">{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
        <div className="text-xs font-semibold text-text-dim mb-2">Sistem Durumu</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Paper Mod",     value: systemConfig.paperTrading ? "Aktif" : "Canlı",  ok: systemConfig.paperTrading },
            { label: "OKX WS",        value: systemConfig.okxWsEnabled ? "Bağlı" : "Kapalı", ok: systemConfig.okxWsEnabled },
            { label: "Bildirimler",   value: systemConfig.notificationsEnabled ? "ON" : "OFF", ok: systemConfig.notificationsEnabled },
            { label: "Hedef Gecikme", value: `${systemConfig.targetLatencyMs}ms`,             ok: systemConfig.targetLatencyMs <= 3000 },
          ].map((s) => (
            <div key={s.label} className="bg-bg-soft rounded-xl p-2.5 border border-line">
              <div className="text-[10px] text-text-dim">{s.label}</div>
              <div className={`text-sm font-semibold mt-0.5 ${s.ok ? "text-up" : "text-text-dim"}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
