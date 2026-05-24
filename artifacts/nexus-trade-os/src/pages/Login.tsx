import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

const TICKER_ITEMS = [
  { sym: "BTC/USDT", px: "104,832.50", chg: "+2.34%", up: true },
  { sym: "ETH/USDT", px: "3,891.20",   chg: "+1.87%", up: true },
  { sym: "BNB/USDT", px: "712.40",     chg: "-0.42%", up: false },
  { sym: "SOL/USDT", px: "198.65",     chg: "+4.12%", up: true },
  { sym: "XRP/USDT", px: "0.6234",     chg: "+0.98%", up: true },
  { sym: "ADA/USDT", px: "0.4521",     chg: "-1.23%", up: false },
];

export default function Login() {
  const [email,   setEmail]   = useState("admin@nexus.local");
  const [pw,      setPw]      = useState("nexus2024");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const setAuth = useStore((s) => s.setAuth);
  const [, navigate] = useLocation();

  // Force dark mode on login page
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const d = await api.login(email, pw);
      setAuth(d.token, d.role);
      navigate("/");
    } catch {
      setErr("Geçersiz e-posta veya parola");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#0b0e11] text-[#eaecef] overflow-hidden">

      {/* ── Animated background grid ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(#f0b90b 1px, transparent 1px), linear-gradient(90deg, #f0b90b 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#f0b90b]/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#1890ff]/5 blur-3xl" />
        {/* Chart lines decoration */}
        <svg className="absolute bottom-0 left-0 right-0 opacity-10" viewBox="0 0 1440 200" preserveAspectRatio="none">
          <polyline
            points="0,160 120,140 240,155 360,120 480,130 600,90 720,110 840,80 960,95 1080,60 1200,75 1320,45 1440,55"
            fill="none" stroke="#0ecb81" strokeWidth="2"
          />
          <polyline
            points="0,180 120,170 240,175 360,155 480,165 600,140 720,150 840,125 960,140 1080,110 1200,125 1320,100 1440,115"
            fill="none" stroke="#f0b90b" strokeWidth="1.5" strokeDasharray="6 4"
          />
        </svg>
      </div>

      {/* ── Ticker bar ── */}
      <div className="relative z-10 border-b border-[#2b3139] bg-[#161a1f]/80 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-6 px-4 py-2 overflow-x-auto scrollbar-none">
          {TICKER_ITEMS.map((t) => (
            <div key={t.sym} className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-semibold text-[#848e9c]">{t.sym}</span>
              <span className="text-[11px] font-mono font-bold text-[#eaecef]">{t.px}</span>
              <span className={`text-[10px] font-semibold ${t.up ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>{t.chg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#f0b90b] mb-4 shadow-[0_0_32px_rgba(240,185,11,0.3)]">
              <span className="text-black font-black text-2xl">N</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              Nexus<span className="text-[#f0b90b]">OS</span>
            </h1>
            <p className="text-[#848e9c] text-sm mt-1">Professional Trading Platform</p>
          </div>

          {/* Login card */}
          <div className="bg-[#161a1f] border border-[#2b3139] rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-bold text-[#eaecef] mb-5">Hesabınıza giriş yapın</h2>

            <form onSubmit={submit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#848e9c]">E-posta</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1e2329] border border-[#2b3139] rounded-xl px-4 py-3 text-sm text-[#eaecef] placeholder-[#5e6673] transition-all"
                    placeholder="admin@nexus.local"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#848e9c]">Parola</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="w-full bg-[#1e2329] border border-[#2b3139] rounded-xl px-4 py-3 pr-10 text-sm text-[#eaecef] placeholder-[#5e6673] transition-all"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5e6673] hover:text-[#848e9c] transition"
                  >
                    {showPw ? (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                        <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.4" />
                        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                        <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                        <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.4" />
                        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {err && (
                <div className="flex items-center gap-2 bg-[#f6465d]/10 border border-[#f6465d]/20 rounded-xl px-3 py-2.5">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="#f6465d" strokeWidth="1.5" />
                    <line x1="8" y1="5" x2="8" y2="9" stroke="#f6465d" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="8" cy="11.5" r="0.8" fill="#f6465d" />
                  </svg>
                  <span className="text-xs text-[#f6465d]">{err}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#f0b90b] text-black font-bold text-sm hover:bg-[#f8d33a] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(240,185,11,0.25)] hover:shadow-[0_4px_24px_rgba(240,185,11,0.35)]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10" />
                    </svg>
                    Giriş yapılıyor...
                  </span>
                ) : "Giriş Yap"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[#2b3139]" />
              <span className="text-[10px] text-[#5e6673] font-medium">DEMO</span>
              <div className="flex-1 h-px bg-[#2b3139]" />
            </div>

            {/* Demo credentials */}
            <div className="bg-[#1e2329] rounded-xl p-3 border border-[#2b3139]">
              <div className="text-[10px] text-[#5e6673] mb-2 font-semibold uppercase tracking-wider">Demo Hesabı</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#848e9c]">E-posta</span>
                  <span className="text-[11px] font-mono text-[#eaecef]">admin@nexus.local</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#848e9c]">Parola</span>
                  <span className="text-[11px] font-mono text-[#eaecef]">nexus2024</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 space-y-1">
            <div className="flex items-center justify-center gap-4 text-[10px] text-[#5e6673]">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />
                Sistem Aktif
              </span>
              <span>·</span>
              <span>Paper Trading Modu</span>
              <span>·</span>
              <span>v2.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
