import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, User } from "@/lib/api";
import { Shield, ShieldCheck, Key } from "lucide-react";

export default function Users() {
  const token = useStore((s) => s.token);
  const [list, setList] = useState<User[]>([]);
  useEffect(() => {
    if (!token) return;
    api.getUsers().then(setList).catch(() => {});
  }, [token]);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-text">Kullanıcılar</h1>
      <div className="bg-bg-elev border border-line rounded-xl divide-y divide-line">
        {list.map((u) => (
          <div key={u.id} className="px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/15 grid place-items-center">
                <span className="text-xs font-bold text-accent">{u.email[0].toUpperCase()}</span>
              </div>
              <div>
                <div className="text-sm font-medium text-text">{u.email}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-text-dim">{u.role}</span>
                  {u.totp_enabled && (
                    <span className="flex items-center gap-0.5 text-[10px] text-up">
                      <Key size={9} /> 2FA
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
              u.role === "admin" ? "bg-accent/15 text-accent" : "bg-bg-soft text-text-dim"
            }`}>
              {u.role === "admin" ? <ShieldCheck size={11} /> : <Shield size={11} />}
              {u.role}
            </span>
          </div>
        ))}
        {list.length === 0 && <div className="px-3 py-8 text-text-dim text-sm text-center">Kullanıcı yok</div>}
      </div>
    </div>
  );
}
