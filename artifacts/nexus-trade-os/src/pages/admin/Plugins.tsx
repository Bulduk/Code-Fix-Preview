/**
 * Nexus Plugin / Extension Marketplace
 *
 * Sistem, bir GitHub repo URL'si (veya npm paketi) alır → repo analiz eder →
 * entegrasyon noktası önerir → kullanıcı onaylar → plugin etkinleştirilir.
 */
import { useState, useEffect } from "react";
import {
  Github, PackagePlus, Zap, Check, X, Loader2, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, Code2, ShieldCheck, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────
type PluginStatus  = "enabled" | "disabled" | "analyzing" | "error";
type PluginKind    = "data_feed" | "strategy" | "risk_engine" | "notification" | "llm_provider" | "exchange_adapter";
type IntegrationHook =
  | "onTick"           // her fiyat güncellemesinde
  | "onSignal"         // sinyal üretildiğinde
  | "beforeOrder"      // emir gönderilmeden önce
  | "afterOrder"       // emir tamamlandıktan sonra
  | "onBalance"        // bakiye değiştiğinde
  | "onPnLSnapshot";   // PnL snapshot alınırken

type Plugin = {
  id:          string;
  name:        string;
  description: string;
  repoUrl?:    string;
  npmPackage?: string;
  version:     string;
  kind:        PluginKind;
  author:      string;
  hooks:       IntegrationHook[];
  status:      PluginStatus;
  builtIn:     boolean;
  configSchema?: { key: string; label: string; type: "string"|"number"|"boolean"; required: boolean }[];
  config:      Record<string, unknown>;
  lastChecked?: string;
  stars?:      number;
};

// ─── Built-in Plugin Registry ─────────────────────────────────────────────
const BUILT_IN_PLUGINS: Plugin[] = [
  {
    id:"nexus-okx-feed", name:"OKX WebSocket Feed", builtIn:true, status:"enabled",
    description:"OKX Public WS üzerinden gerçek zamanlı ticker verileri. 14 parite, düşük gecikme.",
    version:"1.0.0", kind:"data_feed", author:"Nexus Core",
    hooks:["onTick"], config:{}, stars:undefined,
  },
  {
    id:"nexus-ccxt-adapter", name:"CCXT Multi-Exchange Adapter", builtIn:true, status:"enabled",
    description:"CCXT Pro aracılığıyla 100+ borsa desteği. API key vault entegrasyonu.",
    version:"1.0.0", kind:"exchange_adapter", author:"Nexus Core",
    hooks:["beforeOrder","afterOrder"], config:{}, stars:undefined,
  },
  {
    id:"nexus-barter-risk", name:"Barter-rs Risk Engine", builtIn:true, status:"disabled",
    description:"Rust tabanlı risk motoru. Kelly pozisyon boyutlaması, SL/TP otomatik hesaplama. VPS gerektirir.",
    version:"0.1.0", kind:"risk_engine", author:"Nexus Core",
    hooks:["beforeOrder"],
    config:{ barter_url:"http://vps:8090" },
    configSchema:[{ key:"barter_url", label:"Barter-rs URL", type:"string", required:true }],
  },
  {
    id:"nexus-nautilus", name:"Nautilus Trader Orchestrator", builtIn:true, status:"disabled",
    description:"Python tabanlı yüksek performanslı trading framework. LangGraph + CCXT Pro. VPS gerektirir.",
    version:"0.1.0", kind:"strategy", author:"Nexus Core",
    hooks:["onSignal","beforeOrder"],
    config:{ nautilus_url:"http://vps:8091" },
    configSchema:[{ key:"nautilus_url", label:"Nautilus URL", type:"string", required:true }],
  },
  {
    id:"nexus-telegram", name:"Telegram Approval Bot", builtIn:true, status:"disabled",
    description:"Yarı-oto modda emir onayı için Telegram botu. İşlem öncesi onay + anlık bildirimler.",
    version:"1.0.0", kind:"notification", author:"Nexus Core",
    hooks:["beforeOrder","afterOrder"],
    config:{ bot_token:"", chat_id:"" },
    configSchema:[
      { key:"bot_token", label:"Bot Token", type:"string", required:true },
      { key:"chat_id",   label:"Chat ID",   type:"string", required:true },
    ],
  },
];

// ─── GitHub Repo Analyzer (mock) ──────────────────────────────────────────
type AnalysisResult = {
  name:        string;
  description: string;
  stars:       number;
  language:    string;
  kind:        PluginKind;
  hooks:       IntegrationHook[];
  compatible:  boolean;
  issues:      string[];
  suggestions: string[];
  configSchema: Plugin["configSchema"];
};

async function analyzeRepo(url: string): Promise<AnalysisResult> {
  await new Promise((r) => setTimeout(r, 2200));

  const repoName = url.split("/").slice(-2).join("/");
  const isGithub = url.includes("github.com");

  if (!isGithub) throw new Error("Şu an sadece GitHub repo URL'leri desteklenmektedir");
  if (url.includes("404") || url.includes("invalid")) throw new Error("Repo bulunamadı");

  // Keyword-based mock detection
  const lower = url.toLowerCase();
  let kind: PluginKind = "strategy";
  let hooks: IntegrationHook[] = ["onSignal", "beforeOrder"];

  if (lower.includes("risk"))       { kind = "risk_engine";       hooks = ["beforeOrder"]; }
  else if (lower.includes("alert") || lower.includes("notify")) { kind = "notification"; hooks = ["afterOrder","onSignal"]; }
  else if (lower.includes("feed") || lower.includes("data"))    { kind = "data_feed";    hooks = ["onTick"]; }
  else if (lower.includes("llm") || lower.includes("agent"))    { kind = "llm_provider"; hooks = ["onSignal"]; }
  else if (lower.includes("exchange") || lower.includes("ccxt")){ kind = "exchange_adapter"; hooks = ["beforeOrder","afterOrder"]; }

  return {
    name:        repoName.split("/")[1] ?? repoName,
    description: `${repoName} — Nexus Trade OS uyumlu ${kind.replace("_"," ")} eklentisi`,
    stars:       Math.floor(Math.random() * 800) + 50,
    language:    ["Python","TypeScript","Rust","Go"][Math.floor(Math.random()*4)],
    kind,
    hooks,
    compatible:  true,
    issues:      [],
    suggestions: [
      `"onPluginLoad(config)" fonksiyonu tanımla`,
      `nexus_sdk.${kind.replace("_","")} base class'ını extend et`,
      `README'de entegrasyon örneği ekle`,
    ],
    configSchema: [
      { key:"api_url",  label:"API URL",     type:"string",  required:true  },
      { key:"timeout",  label:"Timeout (ms)",type:"number",  required:false },
      { key:"debug",    label:"Debug Modu",  type:"boolean", required:false },
    ],
  };
}

// ─── Hook badge colors ─────────────────────────────────────────────────────
const HOOK_COLOR: Record<IntegrationHook, string> = {
  onTick:          "bg-sky-50 text-sky-700",
  onSignal:        "bg-purple-50 text-purple-700",
  beforeOrder:     "bg-amber-50 text-amber-700",
  afterOrder:      "bg-green-50 text-green-700",
  onBalance:       "bg-indigo-50 text-indigo-700",
  onPnLSnapshot:   "bg-rose-50 text-rose-700",
};
const KIND_LABEL: Record<PluginKind, string> = {
  data_feed:        "📡 Veri Kaynağı",
  strategy:         "🧠 Strateji",
  risk_engine:      "🛡 Risk Motoru",
  notification:     "🔔 Bildirim",
  llm_provider:     "🤖 LLM Sağlayıcı",
  exchange_adapter: "🔌 Borsa Adaptörü",
};

// ─── Plugin Card ───────────────────────────────────────────────────────────
function PluginCard({ plugin, onToggle, onConfigure }: {
  plugin: Plugin;
  onToggle:    (id: string) => void;
  onConfigure: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const enabled = plugin.status === "enabled";

  return (
    <div className={`border rounded-2xl overflow-hidden transition ${enabled ? "border-line" : "border-line/60 opacity-80"}`}>
      <div className="px-4 py-3 bg-bg-elev">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-text">{plugin.name}</span>
              {plugin.builtIn && <span className="text-[10px] bg-bg-soft text-text-dim px-1.5 py-0.5 rounded font-medium">built-in</span>}
              <span className="text-[10px] text-text-dim">{plugin.version}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-soft text-text-dim">{KIND_LABEL[plugin.kind]}</span>
              {plugin.stars && <span className="text-[10px] text-amber-500">★ {plugin.stars}</span>}
            </div>
            <p className="text-xs text-text-dim mt-1 leading-relaxed">{plugin.description}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {plugin.hooks.map((h) => (
                <span key={h} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${HOOK_COLOR[h]}`}>{h}()</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {plugin.repoUrl && (
              <a href={plugin.repoUrl} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-soft transition">
                <ExternalLink size={12} />
              </a>
            )}
            {plugin.configSchema && plugin.configSchema.length > 0 && (
              <button onClick={() => onConfigure(plugin.id)}
                className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-soft transition">
                <Code2 size={12} />
              </button>
            )}
            <button onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-soft transition">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button onClick={() => onToggle(plugin.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                enabled
                  ? "bg-up/10 text-up hover:bg-up/20"
                  : "bg-bg-soft text-text-dim hover:bg-line"
              }`}>
              {enabled ? <Check size={11} /> : null}
              {enabled ? "Aktif" : "Pasif"}
            </button>
          </div>
        </div>

        {expanded && plugin.configSchema && (
          <div className="mt-3 pt-3 border-t border-line space-y-2">
            <div className="text-[11px] font-semibold text-text-dim">Konfigürasyon</div>
            {plugin.configSchema.map(({ key, label, type, required }) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-xs text-text-dim w-28 shrink-0">{label}{required && <span className="text-down">*</span>}</label>
                {type === "boolean" ? (
                  <input type="checkbox" defaultChecked={Boolean(plugin.config[key])}
                    className="accent-amber-500 w-4 h-4" />
                ) : (
                  <input type={type === "number" ? "number" : "text"}
                    defaultValue={String(plugin.config[key] ?? "")}
                    placeholder={required ? "gerekli" : "opsiyonel"}
                    className="flex-1 bg-bg-soft border border-line rounded-lg px-2 py-1 text-xs text-text outline-none focus:border-accent font-mono" />
                )}
              </div>
            ))}
            <button className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-amber-600 transition mt-1">Kaydet</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function Plugins() {
  const [plugins, setPlugins]   = useState<Plugin[]>(BUILT_IN_PLUGINS);
  const [repoUrl, setRepoUrl]   = useState("");
  const [analyzing, setAna]     = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzeErr, setAnaErr] = useState<string | null>(null);
  const [adding, setAdding]     = useState(false);
  const [tab, setTab]           = useState<"installed" | "discover">("installed");
  const [configTarget, setCfgT] = useState<string | null>(null);

  const DISCOVER_REPOS = [
    { url:"https://github.com/TA-Lib/ta-lib-python", name:"TA-Lib Indicators", kind:"data_feed" as PluginKind, stars:9200, desc:"50+ teknik indikatör — RSI, MACD, Bollinger, ATR" },
    { url:"https://github.com/freqtrade/freqtrade",  name:"Freqtrade Adapter",  kind:"strategy"  as PluginKind, stars:28000, desc:"Freqtrade stratejilerini Nexus'a import et" },
    { url:"https://github.com/pmorissette/bt",       name:"Backtesting.py",     kind:"strategy"  as PluginKind, stars:1800, desc:"Python backtesting framework entegrasyonu" },
    { url:"https://github.com/hummingbot/hummingbot",name:"Hummingbot MM",     kind:"strategy"  as PluginKind, stars:8100, desc:"Market making stratejileri adaptörü" },
    { url:"https://github.com/nicehash/NiceHashQuickMiner", name:"Binance Feed+", kind:"data_feed" as PluginKind, stars:450, desc:"Gelişmiş Binance WebSocket veri akışı" },
  ];

  const togglePlugin = (id: string) => {
    setPlugins((prev) => prev.map((p) => p.id === id
      ? { ...p, status: p.status === "enabled" ? "disabled" : "enabled" }
      : p
    ));
  };

  const analyzeRepoFn = async () => {
    if (!repoUrl.trim()) return;
    setAna(true); setAnalysis(null); setAnaErr(null);
    try {
      const res = await analyzeRepo(repoUrl.trim());
      setAnalysis(res);
    } catch (e) {
      setAnaErr(String(e));
    }
    setAna(false);
  };

  const installPlugin = async () => {
    if (!analysis) return;
    setAdding(true);
    await new Promise((r) => setTimeout(r, 900));
    const newPlugin: Plugin = {
      id:          `custom-${Date.now()}`,
      name:        analysis.name,
      description: analysis.description,
      repoUrl:     repoUrl.trim(),
      version:     "latest",
      kind:        analysis.kind,
      author:      repoUrl.split("/").slice(-2)[0] ?? "Community",
      hooks:       analysis.hooks,
      status:      "disabled",
      builtIn:     false,
      configSchema:analysis.configSchema,
      config:      {},
      stars:       analysis.stars,
      lastChecked: new Date().toISOString(),
    };
    setPlugins((prev) => [newPlugin, ...prev]);
    setAnalysis(null); setRepoUrl(""); setAdding(false);
    setTab("installed");
  };

  const enabled  = plugins.filter((p) => p.status === "enabled");
  const disabled = plugins.filter((p) => p.status !== "enabled");

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-text">Plugin Sistemi</h1>
        <p className="text-xs text-text-dim">GitHub repo analizi → otomatik entegrasyon noktası önerisi → tek tıkla kurulum</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label:"Kurulu",  value:plugins.length,  color:"text-text"  },
          { label:"Aktif",   value:enabled.length,  color:"text-up"    },
          { label:"Hook",    value:[...new Set(plugins.flatMap((p)=>p.hooks))].length, color:"text-accent" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-bg-elev border border-line rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-text-dim mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tab */}
      <div className="flex gap-1 p-1 bg-bg-soft rounded-2xl">
        {([["installed","Kurulu"], ["discover","Keşfet"]] as ["installed"|"discover", string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-xl transition ${tab === id ? "bg-bg-elev text-text shadow-sm" : "text-text-dim hover:text-text"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Installed ── */}
      {tab === "installed" && (
        <div className="space-y-3">
          {/* Import new repo */}
          <div className="bg-bg-elev border border-line rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-text">
              <Github size={14} />
              Repo'dan Plugin Ekle
            </div>
            <div className="flex gap-2">
              <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") analyzeRepoFn(); }}
                placeholder="https://github.com/user/trading-plugin"
                className="flex-1 bg-bg-soft border border-line rounded-xl px-3 py-2 text-sm text-text outline-none focus:border-accent font-mono text-xs" />
              <button onClick={analyzeRepoFn} disabled={analyzing || !repoUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50">
                {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                {analyzing ? "Analiz..." : "Analiz Et"}
              </button>
            </div>

            {analyzeErr && (
              <div className="flex items-center gap-2 text-xs text-down bg-red-50 rounded-xl p-3">
                <AlertTriangle size={12} />
                {analyzeErr}
              </div>
            )}

            {analysis && !analyzeErr && (
              <div className="border border-line rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-bg-soft border-b border-line flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-up" />
                    <span className="text-sm font-semibold text-text">{analysis.name}</span>
                    <span className="text-[10px] text-text-dim">{analysis.language}</span>
                    {analysis.stars && <span className="text-[10px] text-amber-500">★ {analysis.stars}</span>}
                  </div>
                  {analysis.compatible && <span className="text-[10px] text-up bg-green-50 px-1.5 py-0.5 rounded font-medium">✓ Uyumlu</span>}
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-text-dim">{analysis.description}</p>
                  <div>
                    <div className="text-[11px] font-semibold text-text-dim mb-1.5">Entegrasyon Hook'ları</div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.hooks.map((h) => (
                        <span key={h} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${HOOK_COLOR[h]}`}>{h}()</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-text-dim mb-1.5">Öneriler</div>
                    <ul className="space-y-1">
                      {analysis.suggestions.map((s, i) => (
                        <li key={i} className="text-xs text-text-dim flex items-start gap-1.5">
                          <span className="text-accent mt-0.5">•</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button onClick={installPlugin} disabled={adding}
                    className="w-full py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {adding ? <Loader2 size={13} className="animate-spin" /> : <PackagePlus size={13} />}
                    {adding ? "Yükleniyor..." : "Sisteme Ekle"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Active */}
          {enabled.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-up mb-2 px-1">Aktif Pluginler ({enabled.length})</div>
              <div className="space-y-2">
                {enabled.map((p) => (
                  <PluginCard key={p.id} plugin={p} onToggle={togglePlugin} onConfigure={setCfgT} />
                ))}
              </div>
            </div>
          )}

          {/* Inactive */}
          {disabled.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-text-dim mb-2 px-1">Pasif ({disabled.length})</div>
              <div className="space-y-2">
                {disabled.map((p) => (
                  <PluginCard key={p.id} plugin={p} onToggle={togglePlugin} onConfigure={setCfgT} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Discover ── */}
      {tab === "discover" && (
        <div className="space-y-3">
          <p className="text-xs text-text-dim px-1">Topluluk tarafından önerilen entegrasyonlar. Nexus SDK'yı implement eden repo'lar otomatik analiz edilir.</p>
          {DISCOVER_REPOS.map((repo) => (
            <div key={repo.url} className="bg-bg-elev border border-line rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-text">{repo.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-soft text-text-dim">{KIND_LABEL[repo.kind]}</span>
                    <span className="text-[10px] text-amber-500">★ {repo.stars.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-text-dim mt-1">{repo.desc}</p>
                  <p className="text-[10px] text-text-dim/60 mt-1 font-mono">{repo.url.replace("https://github.com/","")}</p>
                </div>
                <button
                  onClick={() => { setRepoUrl(repo.url); setTab("installed"); analyzeRepoFn(); }}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-xs text-text-dim hover:text-text hover:bg-bg-soft transition">
                  <RefreshCw size={11} /> Analiz Et
                </button>
              </div>
            </div>
          ))}

          {/* Integration architecture diagram */}
          <div className="bg-bg-elev border border-line rounded-2xl p-4">
            <div className="text-xs font-semibold text-text mb-3">Plugin Entegrasyon Noktaları</div>
            <div className="space-y-2 font-mono text-[11px]">
              {[
                { hook:"onTick(price, sym, ex)", color:"text-sky-600",  desc:"Fiyat güncellemesi" },
                { hook:"onSignal(signal)",        color:"text-purple-600",desc:"Sinyal üretildi" },
                { hook:"beforeOrder(cmd)",         color:"text-amber-600",desc:"Emir öncesi → durdurabilir" },
                { hook:"afterOrder(result)",       color:"text-green-600",desc:"Emir sonrası → kayıt/bildirim" },
                { hook:"onBalance(balances)",      color:"text-indigo-600",desc:"Bakiye değişimi" },
                { hook:"onPnLSnapshot(pnl)",       color:"text-rose-600", desc:"PnL snapshot" },
              ].map(({ hook, color, desc }) => (
                <div key={hook} className="flex items-center gap-3">
                  <span className={`${color} w-52 shrink-0`}>{hook}</span>
                  <span className="text-text-dim text-[10px]">→ {desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-text-dim bg-bg-soft rounded-lg p-2.5">
              Plugin SDK: <code className="text-accent">import {"{"} NexusPlugin {"}"} from "nexus-sdk"</code>
              <br />Her plugin <code>NexusPlugin</code> sınıfını extend eder ve hook metodlarını override eder.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
