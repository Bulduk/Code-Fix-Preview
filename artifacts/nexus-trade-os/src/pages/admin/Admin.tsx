import { Link } from "wouter";
import { Server, BarChart2, Users, FileText } from "lucide-react";

const cards = [
  { href: "/admin/exchanges", title: "Borsalar", desc: "Hesap ekle, paper/testnet/live", icon: Server },
  { href: "/admin/strategies", title: "Stratejiler", desc: "Aç/kapat, parametre yönetimi", icon: BarChart2 },
  { href: "/admin/users", title: "Kullanıcılar", desc: "RBAC rolleri, 2FA durumu", icon: Users },
  { href: "/admin/audit", title: "Audit Log", desc: "Sistem aksiyonları ve geçmiş", icon: FileText },
];

export default function Admin() {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-text">Admin Paneli</h1>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <a className="bg-bg-elev border border-line rounded-xl p-4 hover:bg-bg-soft transition flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-accent/10 grid place-items-center mt-0.5 shrink-0">
                <c.icon size={15} className="text-accent" />
              </div>
              <div>
                <div className="font-medium text-text">{c.title}</div>
                <div className="text-text-dim text-xs mt-0.5">{c.desc}</div>
              </div>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
