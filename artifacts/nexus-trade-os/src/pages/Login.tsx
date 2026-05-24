import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

export default function Login() {
  const [email, setEmail] = useState("admin@nexus.local");
  const [pw, setPw] = useState("nexus2024");
  const [totp, setTotp] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useStore((s) => s.setAuth);
  const [, navigate] = useLocation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const d = await api.login(email, pw);
      setAuth(d.token, d.role);
      navigate("/");
    } catch {
      setErr("Geçersiz giriş bilgileri");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-4 bg-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-3xl font-bold tracking-tight">Nexus<span className="text-accent">.</span></div>
          <div className="text-text-dim text-sm mt-1">Trading OS — Sisteme giriş yap</div>
        </div>
        <form
          onSubmit={submit}
          className="bg-bg-elev border border-line rounded-2xl p-6 space-y-3"
        >
          <div className="space-y-1">
            <label className="text-xs text-text-dim">E-posta</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-soft px-3 py-2.5 rounded outline-none border border-transparent focus:border-accent/50 text-text"
              placeholder="admin@nexus.local"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-dim">Parola</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full bg-bg-soft px-3 py-2.5 rounded outline-none border border-transparent focus:border-accent/50 text-text"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-dim">TOTP kodu (opsiyonel)</label>
            <input
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              className="w-full bg-bg-soft px-3 py-2.5 rounded outline-none border border-transparent focus:border-accent/50 text-text font-mono"
              placeholder="123456"
            />
          </div>
          {err && <div className="text-down text-sm bg-down/10 rounded px-3 py-2">{err}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded bg-accent text-bg font-semibold hover:bg-accent/90 transition disabled:opacity-60"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş"}
          </button>
        </form>
        <div className="text-center text-xs text-text-dim">
          Demo: <span className="font-mono text-text">admin@nexus.local</span> / <span className="font-mono text-text">nexus2024</span>
        </div>
      </div>
    </div>
  );
}
