import { Link } from "wouter";
import { Server, BarChart2, Users, FileText, MessageSquare, Shield } from "lucide-react";

const cards = [
  { href: "/admin/exchanges", title: "Borsalar", desc: "CCXT Pro, paper/testnet/live hesaplar", icon: Server },
  { href: "/admin/strategies", title: "Stratejiler", desc: "SL/TP, LLM model, parametre yönetimi", icon: BarChart2 },
  { href: "/risk", title: "Risk Yöneticisi", desc: "Pozisyon limitleri, Rust doğrulama", icon: Shield },
  { href: "/admin/telegram", title: "Telegram", desc: "Human-in-the-loop onay mekanizması", icon: MessageSquare },
  { href: "/admin/users", title: "Kullanıcılar", desc: "RBAC rolleri, 2FA durumu", icon: Users },
  { href: "/admin/audit", title: "Audit Log", desc: "Sistem aksiyonları ve geçmiş", icon: FileText },
];

export default function Admin() {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-text">Admin Paneli</h1>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="bg-bg-elev border border-line rounded-xl p-4 hover:bg-bg-soft transition flex gap-3 items-start shadow-card"
          >
            <div className="w-8 h-8 rounded-lg bg-accent/10 grid place-items-center mt-0.5 shrink-0">
              <c.icon size={15} className="text-accent" />
            </div>
            <div>
              <div className="font-medium text-text text-sm">{c.title}</div>
              <div className="text-text-dim text-xs mt-0.5 leading-relaxed">{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
