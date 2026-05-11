import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, Agent, Exchange, MarketType } from "@/lib/api";
import { Bot, Send, Loader2, Power, Cpu, Zap, X, Anchor, BrainCircuit } from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; text: string };

const PROVIDER_MODELS: Record<string, { label: string; models: string[]; color: string }> = {
  anthropic: {
    label: "Anthropic",
    color: "bg-orange-100 text-orange-700",
    models: ["claude-3-5-sonnet-20241022","claude-3-5-haiku-20241022","claude-3-opus-20240229"],
  },
  google: {
    label: "Google",
    color: "bg-blue-100 text-blue-700",
    models: ["gemini-1.5-pro","gemini-1.5-flash","gemini-2.0-flash"],
  },
  openai: {
    label: "OpenAI",
    color: "bg-green-100 text-green-700",
    models: ["gpt-4o","gpt-4o-mini","gpt-4-turbo"],
  },
  nautilus: {
    label: "Nautilus",
    color: "bg-teal-100 text-teal-700",
    models: ["nautilus-v1"],
  },
};

const QUICK_PROMPTS_LLM = [
  "BTC/USDT teknik analiz yap",
  "Mevcut piyasa riskini değerlendir",
  "ETH için giriş noktası öner",
  "Portföy korelasyonunu analiz et",
];
const QUICK_PROMPTS_NAUTILUS = [
  "BTCUSDT backtesting çalıştır",
  "ETHUSDT paper order ver",
  "AgentIntent doğrula ve raporla",
  "Portföy simülasyonu başlat",
];

export default function Agents() {
  const token = useStore((s) => s.token);
  const [list, setList]           = useState<Agent[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [sel, setSel]             = useState<Agent | null>(null);
  const [msg, setMsg]             = useState("");
  const [chat, setChat]           = useState<ChatMsg[]>([]);
  const [thinking, setThinking]   = useState(false);
  const [editOpen, setEditOpen]   = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<Agent>>({});

  useEffect(() => {
    if (!token) return;
    api.getAgents().then((a) => { setList(a); setSel(a.find((x) => x.active) ?? a[0] ?? null); });
    api.getExchanges().then(setExchanges);
  }, [token]);

  const invoke = async (text?: string) => {
    const q = (text ?? msg).trim();
    if (!sel || !q) return;
    setMsg("");
    setChat((c) => [...c, { role: "user", text: q }]);
    setThinking(true);
    try {
      const r = await api.invokeAgent(sel.id, q);
      setChat((c) => [...c, { role: "assistant", text: r.reply }]);
    } finally { setThinking(false); }
  };

  const toggleActive = async (a: Agent) => {
    const updated = await api.updateAgent(a.id, { active: !a.active });
    setList((l) => l.map((x) => x.id === updated.id ? updated : x));
    if (sel?.id === a.id) setSel(updated);
  };

  const openEdit = (a: Agent) => { setEditDraft({ ...a }); setEditOpen(true); };

  const toggleExchange = (exId: string) => {
    const current = editDraft.exchange_ids ?? [];
    const next = current.includes(exId) ? current.filter((e) => e !== exId) : [...current, exId];
    setEditDraft({ ...editDraft, exchange_ids: next });
  };

  const saveEdit = async () => {
    if (!editDraft.id) return;
    const updated = await api.updateAgent(editDraft.id, editDraft);
    setList((l) => l.map((x) => x.id === updated.id ? updated : x));
    if (sel?.id === updated.id) setSel(updated);
    setEditOpen(false);
  };

  const quickPrompts = sel?.agent_type === "nautilus" ? QUICK_PROMPTS_NAUTILUS : QUICK_PROMPTS_LLM;
  const isNautilus   = sel?.agent_type === "nautilus";

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-text">AI Ajanlar</h1>
        <p className="text-xs text-text-dim">Claude · Gemini · GPT · NautilusAgent — LangGraph orkestrasyonu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ minHeight: 520 }}>
        {/* Agent list */}
        <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden flex flex-col shadow-card">
          <div className="px-3 py-2.5 text-xs text-text-dim border-b border-line font-medium">
            Ajanlar ({list.filter((a) => a.active).length}/{list.length} aktif)
          </div>
          <ul className="divide-y divide-line flex-1 overflow-auto">
            {list.map((a) => {
              const pm = PROVIDER_MODELS[a.provider];
              return (
                <li
                  key={a.id}
                  onClick={() => { setSel(a); setChat([]); }}
                  className={`px-3 py-3 cursor-pointer transition ${sel?.id === a.id ? "bg-bg-soft" : "hover:bg-bg-soft/60"}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl grid place-items-center ${a.active ? "bg-accent/15" : "bg-bg-soft"}`}>
                      {a.agent_type === "nautilus"
                        ? <Anchor size={15} className={a.active ? "text-teal-600" : "text-text-dim"} />
                        : <Bot size={15} className={a.active ? "text-accent" : "text-text-dim"} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-text">{a.name}</span>
                        {!a.active && <span className="text-[10px] text-text-dim">(pasif)</span>}
                        {a.agent_type === "nautilus" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-medium">Paper</span>
                        )}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pm?.color}`}>
                        {a.agent_type === "nautilus" ? "Nautilus v1" : a.model.split("-").slice(0, 2).join("-")}
                      </span>
                      {a.exchange_ids.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {a.exchange_ids.slice(0, 2).map((eid) => {
                            const ex = exchanges.find((e) => e.id === eid);
                            return ex ? (
                              <span key={eid} className="text-[9px] px-1 py-0.5 rounded bg-bg-soft border border-line text-text-dim">
                                {ex.exchange}/{ex.label}
                              </span>
                            ) : null;
                          })}
                          {a.exchange_ids.length > 2 && <span className="text-[9px] text-text-dim">+{a.exchange_ids.length - 2}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleActive(a)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        a.active ? "bg-up/10 text-up hover:bg-up/20" : "bg-bg-soft text-text-dim hover:bg-line"
                      }`}
                    >
                      <Power size={9} /> {a.active ? "ON" : "OFF"}
                    </button>
                    <button
                      onClick={() => openEdit(a)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-bg-soft text-text-dim hover:bg-line transition"
                    >
                      <Cpu size={9} /> Düzenle
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Chat panel */}
        <div className="md:col-span-2 bg-bg-elev border border-line rounded-2xl flex flex-col overflow-hidden shadow-card">
          {sel ? (
            <>
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-line flex items-center gap-2 flex-wrap">
                <div className={`w-7 h-7 rounded-xl grid place-items-center ${sel.active ? "bg-accent/15" : "bg-bg-soft"}`}>
                  {isNautilus
                    ? <Anchor size={13} className="text-teal-600" />
                    : <Bot size={13} className={sel.active ? "text-accent" : "text-text-dim"} />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-text">{sel.name}</span>
                  <span className="text-xs text-text-dim ml-2 hidden sm:inline">{sel.role}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isNautilus && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium flex items-center gap-1">
                      <Anchor size={9} /> API Gerekmez
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PROVIDER_MODELS[sel.provider]?.color}`}>
                    {PROVIDER_MODELS[sel.provider]?.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-soft text-text-dim border border-line">
                    {sel.model}
                  </span>
                </div>
              </div>

              {/* Exchange assignment badges */}
              {sel.exchange_ids.length > 0 && (
                <div className="px-4 py-2 border-b border-line flex items-center gap-1.5 flex-wrap bg-bg-soft/50">
                  <span className="text-[10px] text-text-dim">Atanan:</span>
                  {sel.exchange_ids.map((eid) => {
                    const ex = exchanges.find((e) => e.id === eid);
                    return ex ? (
                      <span key={eid} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elev border border-line text-text-dim">
                        {ex.exchange}/{ex.label} · {ex.mode}
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {/* NautilusAgent info banner */}
              {isNautilus && (
                <div className="px-4 py-3 bg-teal-50 border-b border-teal-100">
                  <div className="flex items-start gap-2">
                    <BrainCircuit size={15} className="text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-teal-800">Nautilus Paper Trading Agent</div>
                      <div className="text-[11px] text-teal-700 mt-0.5">
                        Borsa API'sı olmadan çalışır. AgentIntent protokolü ile paper emirler yürütür.
                        Backtesting, simülasyon, risk hesaplama. VPS'te <code className="bg-teal-100 px-1 rounded">nautilus</code> üzerinde çalışır.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick prompts */}
              {chat.length === 0 && (
                <div className="px-4 pt-3 flex flex-wrap gap-1.5">
                  {quickPrompts.map((q) => (
                    <button
                      key={q}
                      onClick={() => invoke(q)}
                      className="text-xs px-2.5 py-1 rounded-full bg-bg-soft border border-line text-text-dim hover:text-text hover:bg-line transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {chat.length === 0 && (
                  <div className="text-center text-text-dim text-sm py-6">
                    {isNautilus ? "Nautilus'a paper işlem komutu ver" : "Ajana bir soru sor veya hızlı sorgu seç"}
                  </div>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className={`w-7 h-7 rounded-xl grid place-items-center mr-2 shrink-0 mt-1 ${isNautilus ? "bg-teal-100" : "bg-accent/15"}`}>
                        {isNautilus
                          ? <Anchor size={12} className="text-teal-600" />
                          : <Bot size={12} className="text-accent" />}
                      </div>
                    )}
                    <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent/10 text-text border border-accent/20"
                        : "bg-bg-soft text-text border border-line"
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex justify-start">
                    <div className={`w-7 h-7 rounded-xl grid place-items-center mr-2 shrink-0 mt-1 ${isNautilus ? "bg-teal-100" : "bg-accent/15"}`}>
                      {isNautilus ? <Anchor size={12} className="text-teal-600" /> : <Bot size={12} className="text-accent" />}
                    </div>
                    <div className="bg-bg-soft px-3 py-2 rounded-2xl flex items-center gap-2 text-text-dim text-sm border border-line">
                      <Loader2 size={13} className="animate-spin" />
                      <span className="text-xs">{isNautilus ? "Nautilus simülasyon çalışıyor..." : `${PROVIDER_MODELS[sel.provider]?.label} düşünüyor...`}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-line flex gap-2">
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); invoke(); } }}
                  rows={2}
                  placeholder={isNautilus ? "Paper emir / backtesting komutu... (Enter)" : `${sel.name}'a komut yaz... (Enter)`}
                  className="flex-1 bg-bg-soft border border-line px-3 py-2 rounded-xl outline-none text-sm text-text resize-none placeholder:text-text-dim focus:border-accent"
                />
                <button
                  onClick={() => invoke()}
                  disabled={thinking || !msg.trim() || !sel.active}
                  className={`w-10 h-10 self-end rounded-xl text-white grid place-items-center transition disabled:opacity-40 ${isNautilus ? "bg-teal-500 hover:bg-teal-600" : "bg-accent hover:bg-amber-600"}`}
                >
                  <Send size={15} />
                </button>
              </div>
              {!sel.active && (
                <div className="px-3 pb-2 text-center text-xs text-text-dim">
                  Ajan pasif — ON düğmesine bas
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-text-dim text-sm">Soldan bir ajan seç</div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && editDraft && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4 overflow-auto py-6" onClick={() => setEditOpen(false)}>
          <div className="bg-bg-elev border border-line rounded-2xl p-5 w-full max-w-md space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-accent" />
                <h2 className="font-semibold text-text">Ajan Düzenle</h2>
              </div>
              <button onClick={() => setEditOpen(false)} className="p-1 rounded hover:bg-bg-soft text-text-dim"><X size={15} /></button>
            </div>

            <div>
              <label className="text-xs text-text-dim">İsim</label>
              <input value={editDraft.name ?? ""}
                onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs text-text-dim">Rol / Açıklama</label>
              <input value={editDraft.role ?? ""}
                onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })}
                className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent" />
            </div>

            {editDraft.agent_type !== "nautilus" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-text-dim">Provider</label>
                  <select
                    value={editDraft.provider ?? "anthropic"}
                    onChange={(e) => {
                      const p = e.target.value as Agent["provider"];
                      const firstModel = PROVIDER_MODELS[p].models[0];
                      setEditDraft({ ...editDraft, provider: p, model: firstModel });
                    }}
                    className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none"
                  >
                    {Object.entries(PROVIDER_MODELS)
                      .filter(([k]) => k !== "nautilus")
                      .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-dim">Model</label>
                  <select
                    value={editDraft.model ?? ""}
                    onChange={(e) => setEditDraft({ ...editDraft, model: e.target.value })}
                    className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none"
                  >
                    {(PROVIDER_MODELS[editDraft.provider ?? "anthropic"]?.models ?? []).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Market Type Assignment */}
            <div>
              <label className="text-xs text-text-dim block mb-1.5">Piyasa Tipleri</label>
              <div className="flex flex-wrap gap-1.5">
                {(["spot","perp","futures","margin","polymarket"] as MarketType[]).map((mt) => {
                  const selected = (editDraft.market_types ?? []).includes(mt);
                  const emoji = { spot:"🔵", perp:"⚡", futures:"📅", margin:"⚖️", polymarket:"🎯" }[mt];
                  return (
                    <button key={mt}
                      onClick={() => {
                        const cur = editDraft.market_types ?? [];
                        const next = selected ? cur.filter((x) => x !== mt) : [...cur, mt];
                        setEditDraft({ ...editDraft, market_types: next });
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition ${
                        selected ? "bg-accent/10 border-accent/30 text-accent" : "bg-bg-soft border-line text-text-dim hover:bg-line"
                      }`}>
                      {emoji} {mt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exchange assignment */}
            {editDraft.agent_type !== "nautilus" && exchanges.length > 0 && (
              <div>
                <label className="text-xs text-text-dim block mb-1.5">Atanan Borsalar</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {exchanges.map((ex) => {
                    const selected = (editDraft.exchange_ids ?? []).includes(ex.id);
                    return (
                      <button
                        key={ex.id}
                        onClick={() => toggleExchange(ex.id)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border text-xs font-medium transition text-left ${
                          selected ? "bg-accent/10 border-accent/30 text-accent" : "bg-bg-soft border-line text-text-dim hover:bg-line"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${selected ? "bg-accent" : "bg-text-dim"}`} />
                        {ex.exchange}/{ex.label}
                        <span className="text-[9px] opacity-70">{ex.mode}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-2 rounded-xl border border-line text-sm text-text-dim hover:bg-bg-soft transition">İptal</button>
              <button onClick={saveEdit} className="flex-1 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-amber-600 transition">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
