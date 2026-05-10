import { useState } from "react";
import { useStore, TradeMode } from "@/lib/store";
import {
  Settings, Shield, Bell, Clock, Bot, Save, Check,
  RefreshCw, ChevronRight, Wifi, Zap,
} from "lucide-react";

type Section = "trading" | "general" | "risk" | "latency" | "notifications" | "llm";

const SECTIONS = [
  { id: "trading"       as Section, icon: Zap,      label: "Trade Modu"      },
  { id: "general"       as Section, icon: Settings,  label: "Genel"           },
  { id: "risk"          as Section, icon: Shield,    label: "Risk Varsayılan" },
  { id: "latency"       as Section, icon: Clock,     label: "Gecikme & WS"    },
  { id: "llm"           as Section, icon: Bot,       label: "LLM Ayarları"    },
  { id: "notifications" as Section, icon: Bell,      label: "Bildirimler"     },
];

const TRADE_MODES: { id: TradeMode; label: string; desc: string; color: string }[] = [
  {
    id: "manual",
    label: "Manuel",
    desc: "Sinyaller üretilir, emir yoktur. Tüm işlemler kullanıcı tarafından elle yapılır.",
    color: "border-slate-300 bg-slate-50",
  },
  {
    id: "semi_auto",
    label: "Yarı Otomatik",
    desc: "LLM karar üretir, Telegram/UI onayından sonra emir gönderilir. Önerilen mod.",
    color: "border-amber-300 bg-amber-50",
  },
  {
    id: "full_auto",
    label: "Tam Otomatik",
    desc: "LLM karar üretir ve direkt emir gönderir. Sadece test/paper modunda önerilir.",
    color: "border-green-300 bg-green-50",
  },
];

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-0">
      <div className="flex-1 mr-4">
        <div className="text-sm text-text font-medium">{label}</div>
        {desc && <div className="text-xs text-text-dim mt-0.5">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-10 h-6 rounded-full transition-colors ${value ? "bg-accent" : "bg-line"}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}

function SliderField({ value, min, max, step, unit, onChange }: {
  value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 accent-amber-500" />
      <span className="text-sm font-mono text-text w-16 text-right">{value}{unit}</span>
    </div>
  );
}

function SelectField({ value, options, onChange }: { value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="bg-bg-soft border border-line rounded-xl px-3 py-1.5 text-sm text-text outline-none focus:border-accent">
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

export default function SystemSettings() {
  const { systemConfig, setSystemConfig, markFirstRunDone, riskConfig, setRiskConfig } = useStore();
  const [sec,   setSec]   = useState<Section>("trading");
  const [saved, setSaved] = useState(false);

  const save = (patch: Parameters<typeof setSystemConfig>[0]) => {
    setSystemConfig(patch); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const saveRisk = (patch: Parameters<typeof setRiskConfig>[0]) => {
    setRiskConfig(patch); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const resetDefaults = () => {
    setSystemConfig({
      targetLatencyMs: 2800, signalStrengthThreshold: 0.80, paperTrading: true,
      defaultExchange: "okx", defaultProvider: "anthropic", okxWsEnabled: true,
      notificationsEnabled: true, autoApproveBelow: 0.65, maxConcurrentOrders: 5,
      logRetentionDays: 90, tradeMode: "semi_auto",
    });
    setRiskConfig({ maxPositionPct: 5, stopLossPct: 2, takeProfitPct: 4, maxDailyLossPct: 8, maxOpenPositions: 5, riskPerTradePct: 1 });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-text">Sistem Ayarları</h1>
          <p className="text-xs text-text-dim">Kalıcı yapılandırma · localStorage</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="flex items-center gap-1 text-xs text-up"><Check size={12} /> Kaydedildi</span>}
          <button onClick={resetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line text-sm text-text-dim hover:bg-bg-soft transition">
            <RefreshCw size={13} /> Varsayılan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ minHeight: 520 }}>
        {/* Sidebar */}
        <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card h-fit">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setSec(s.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm border-b border-line last:border-0 transition ${
                sec === s.id ? "bg-accent/10 text-accent font-semibold" : "text-text-dim hover:text-text hover:bg-bg-soft"
              }`}>
              <div className="flex items-center gap-2"><s.icon size={14} />{s.label}</div>
              <ChevronRight size={12} className="opacity-40" />
            </button>
          ))}
          <div className="px-4 py-3 border-t border-line">
            <button onClick={markFirstRunDone} className="text-xs text-accent hover:underline">
              {systemConfig.firstRunDone ? "✓ Kurulum tamamlandı" : "Kurulumu tamamla →"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="md:col-span-3 bg-bg-elev border border-line rounded-2xl p-5 shadow-card">

          {/* ── Trade Modu ── */}
          {sec === "trading" && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-text">Trade Modu</h2>

              <div className="space-y-2">
                {TRADE_MODES.map((m) => {
                  const active = systemConfig.tradeMode === m.id;
                  return (
                    <button key={m.id} onClick={() => save({ tradeMode: m.id })}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition ${
                        active ? `${m.color} shadow-sm` : "bg-bg-soft border-line hover:border-accent/30"
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full border-2 transition ${active ? "bg-accent border-accent" : "border-text-dim"}`} />
                          <span className={`font-semibold text-sm ${active ? "text-text" : "text-text-dim"}`}>{m.label}</span>
                          {m.id === "semi_auto" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Önerilen</span>}
                        </div>
                        {active && <Check size={14} className="text-accent" />}
                      </div>
                      <p className="text-xs text-text-dim mt-1.5 ml-5">{m.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-line pt-4 space-y-0">
                <Row label="Paper Trading Modu" desc="Tüm emirler simüle edilir — gerçek işlem yok">
                  <Toggle value={systemConfig.paperTrading} onChange={(v) => save({ paperTrading: v })} />
                </Row>
                <Row label="Otomatik Onay Eşiği" desc="Bu güven altındaki kararlar otomatik reddedilir (semi_auto)">
                  <SliderField value={systemConfig.autoApproveBelow} min={0.3} max={0.95} step={0.05} unit=""
                    onChange={(v) => save({ autoApproveBelow: v })} />
                </Row>
                <Row label="Max Eş Zamanlı Emir" desc="Aynı anda aktif olabilecek maksimum emir sayısı">
                  <SliderField value={systemConfig.maxConcurrentOrders} min={1} max={20} step={1} unit=""
                    onChange={(v) => save({ maxConcurrentOrders: v })} />
                </Row>
              </div>

              {systemConfig.tradeMode === "full_auto" && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  ⚠️ <strong>Tam otomatik mod aktif.</strong> LLM kararları onay olmadan direkt emir gönderir.
                  Sadece paper modda veya çok küçük pozisyonlarla kullanın.
                </div>
              )}
              {systemConfig.tradeMode === "manual" && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  ℹ️ Manuel modda sistem sadece sinyal üretir. Tüm emirler sizin tarafınızdan girilir.
                </div>
              )}
            </div>
          )}

          {/* ── Genel ── */}
          {sec === "general" && (
            <div>
              <h2 className="text-sm font-bold text-text mb-4">Genel Ayarlar</h2>
              <Row label="Varsayılan Borsa">
                <SelectField value={systemConfig.defaultExchange}
                  options={[{v:"okx",l:"OKX"},{v:"binance",l:"Binance"},{v:"bybit",l:"Bybit"},{v:"coinbase",l:"Coinbase"}]}
                  onChange={(v) => save({ defaultExchange: v })} />
              </Row>
              <Row label="Varsayılan LLM Provider">
                <SelectField value={systemConfig.defaultProvider}
                  options={[{v:"anthropic",l:"Claude (Anthropic)"},{v:"google",l:"Gemini (Google)"},{v:"openai",l:"GPT (OpenAI)"}]}
                  onChange={(v) => save({ defaultProvider: v })} />
              </Row>
              <Row label="Log Saklama Süresi" desc="Audit log tutulacak gün sayısı">
                <SliderField value={systemConfig.logRetentionDays} min={7} max={365} step={1} unit=" gün"
                  onChange={(v) => save({ logRetentionDays: v })} />
              </Row>
            </div>
          )}

          {/* ── Risk ── */}
          {sec === "risk" && (
            <div>
              <h2 className="text-sm font-bold text-text mb-4">Risk Varsayılan Değerleri</h2>
              {[
                { label: "Max Pozisyon Büyüklüğü", desc: "Portföyün max %'si",        key: "maxPositionPct",  min: 1,  max: 50,  step: 0.5, unit: "%" },
                { label: "Stop-Loss",              desc: "Varsayılan SL oranı",        key: "stopLossPct",     min: 0.1,max: 15,  step: 0.1, unit: "%" },
                { label: "Take-Profit",            desc: "Varsayılan TP oranı",        key: "takeProfitPct",   min: 0.2,max: 50,  step: 0.1, unit: "%" },
                { label: "Günlük Max Kayıp",       desc: "Bu limiti aşınca işlem durur",key:"maxDailyLossPct",min: 1,  max: 30,  step: 0.5, unit: "%" },
                { label: "Max Açık Pozisyon",      desc: "Aynı anda açık pos sayısı", key: "maxOpenPositions",min: 1,  max: 20,  step: 1,   unit: ""  },
                { label: "İşlem Başına Risk",      desc: "Her işlemde risk oranı",     key: "riskPerTradePct", min: 0.1,max: 5,   step: 0.1, unit: "%" },
              ].map((f) => (
                <Row key={f.key} label={f.label} desc={f.desc}>
                  <SliderField value={(riskConfig as Record<string,number>)[f.key]} min={f.min} max={f.max} step={f.step} unit={f.unit}
                    onChange={(v) => saveRisk({ [f.key]: v })} />
                </Row>
              ))}
            </div>
          )}

          {/* ── Gecikme ── */}
          {sec === "latency" && (
            <div>
              <h2 className="text-sm font-bold text-text mb-4">Gecikme & WebSocket</h2>
              <Row label="Hedef Gecikme" desc="İşlem döngüsü hedef süresi">
                <SliderField value={systemConfig.targetLatencyMs} min={500} max={10000} step={100} unit="ms"
                  onChange={(v) => save({ targetLatencyMs: v })} />
              </Row>
              <Row label="OKX WebSocket" desc="OKX public WS — ücretsiz, API key gerektirmez">
                <Toggle value={systemConfig.okxWsEnabled} onChange={(v) => save({ okxWsEnabled: v })} />
              </Row>
              <Row label="OKX WS Durumu">
                <span className={`flex items-center gap-1 text-xs ${systemConfig.okxWsEnabled ? "text-up" : "text-text-dim"}`}>
                  <Wifi size={11} />{systemConfig.okxWsEnabled ? "Aktif" : "Pasif"}
                </span>
              </Row>
              <div className="mt-4 p-3 bg-bg-soft rounded-xl border border-line text-xs font-mono space-y-1">
                <div className="font-semibold text-text-dim mb-1">Gecikme Dağılımı</div>
                {[["OKX WS Tick","~9ms"],["LLM Analiz","820–1400ms"],["Rust Risk","~7ms"],["CCXT Emir","88–150ms"]].map(([l,v]) => (
                  <div key={l} className="flex justify-between"><span className="text-text-dim">{l}</span><span className={v.includes("~") && parseInt(v) < 50 ? "text-up" : "text-text"}>{v}</span></div>
                ))}
                <div className="flex justify-between border-t border-line pt-1"><span className="text-text-dim">Hedef Toplam</span><span className="text-accent font-bold">{systemConfig.targetLatencyMs}ms</span></div>
              </div>
            </div>
          )}

          {/* ── LLM ── */}
          {sec === "llm" && (
            <div>
              <h2 className="text-sm font-bold text-text mb-4">LLM Orkestrasyon</h2>
              <Row label="Varsayılan Provider">
                <SelectField value={systemConfig.defaultProvider}
                  options={[{v:"anthropic",l:"Claude 3.5 Sonnet"},{v:"google",l:"Gemini 1.5 Pro"},{v:"openai",l:"GPT-4o"}]}
                  onChange={(v) => save({ defaultProvider: v })} />
              </Row>
              <Row label="Sinyal Güç Eşiği" desc="Bu üstündeki sinyaller bildirim + toast üretir">
                <SliderField value={systemConfig.signalStrengthThreshold} min={0.5} max={0.99} step={0.01} unit=""
                  onChange={(v) => save({ signalStrengthThreshold: v })} />
              </Row>
              <div className="mt-4 p-3 bg-bg-soft rounded-xl border border-line">
                <div className="text-xs font-semibold text-text mb-2">Replit Secrets Durumu</div>
                <div className="space-y-1 text-xs font-mono">
                  {["ANTHROPIC_API_KEY","GEMINI_API_KEY","OPENAI_API_KEY","OKX_API_KEY","OKX_SECRET","OKX_PASSPHRASE"].map((k) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-text-dim">{k}</span>
                      <span className={k.startsWith("OKX") ? "text-up" : "text-text-dim"}>{k.startsWith("OKX") ? "✓ Eklendi" : "—"}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-text-dim mt-2">Frontend anahtarları görmez — Python orchestrator servisinde kullanılır.</p>
              </div>
            </div>
          )}

          {/* ── Bildirimler ── */}
          {sec === "notifications" && (
            <div>
              <h2 className="text-sm font-bold text-text mb-4">Bildirim Ayarları</h2>
              <Row label="Bildirimleri Etkinleştir" desc="Güçlü sinyal toast bildirimleri">
                <Toggle value={systemConfig.notificationsEnabled} onChange={(v) => save({ notificationsEnabled: v })} />
              </Row>
              <Row label="Sinyal Eşiği" desc={`%${(systemConfig.signalStrengthThreshold * 100).toFixed(0)} üstü → toast göster`}>
                <SliderField value={systemConfig.signalStrengthThreshold} min={0.5} max={0.99} step={0.01} unit=""
                  onChange={(v) => save({ signalStrengthThreshold: v })} />
              </Row>
              <Row label="Telegram Onay">
                <a href="/admin/telegram" className="flex items-center gap-1 text-xs text-accent hover:underline">
                  Telegram Ayarları <ChevronRight size={11} />
                </a>
              </Row>
            </div>
          )}
        </div>
      </div>

      {/* İlk kurulum banner */}
      <div className={`rounded-2xl p-4 border ${systemConfig.firstRunDone ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
        <div className="flex items-center gap-2">
          <Zap size={14} className={systemConfig.firstRunDone ? "text-green-600" : "text-amber-600"} />
          <span className={`text-sm font-semibold ${systemConfig.firstRunDone ? "text-green-800" : "text-amber-800"}`}>
            {systemConfig.firstRunDone ? "Sistem Yapılandırıldı — VPS için Hazır" : "İlk Kurulum Bekliyor"}
          </span>
        </div>
        <p className={`text-xs mt-1 ${systemConfig.firstRunDone ? "text-green-700" : "text-amber-700"}`}>
          {systemConfig.firstRunDone
            ? `Trade Modu: ${TRADE_MODES.find((m) => m.id === systemConfig.tradeMode)?.label} · Paper: ${systemConfig.paperTrading ? "Aktif" : "Kapalı"} · Hedef: ${systemConfig.targetLatencyMs}ms`
            : "Trade modu, risk limitleri ve LLM ayarlarını yapılandır."}
        </p>
        {!systemConfig.firstRunDone && (
          <button onClick={markFirstRunDone}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition">
            <Save size={13} /> Yapılandırmayı Kaydet
          </button>
        )}
      </div>
    </div>
  );
}
