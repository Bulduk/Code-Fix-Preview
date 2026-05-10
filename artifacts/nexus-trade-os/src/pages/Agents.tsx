import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, Agent } from "@/lib/api";
import { Bot, Send, Loader2, Power, Cpu, Zap } from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; text: string };

const PROVIDER_MODELS: Record<string, { label: string; models: string[] }> = {
  anthropic: {
    label: "Anthropic",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  },
  google: {
    label: "Google",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
  },
  openai: {
    label: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-100 text-orange-700",
  google: "bg-blue-100 text-blue-700",
  openai: "bg-green-100 text-green-700",
};

const QUICK_PROMPTS = [
  "BTC/USDT teknik analiz yap",
  "Mevcut piyasa riskini değerlendir",
  "ETH için giriş noktası öner",
  "Portföy korelasyonunu analiz et",
];

export default function Agents() {
  const token = useStore((s) => s.token);
  const [list, setList] = useState<Agent[]>([]);
  const [sel, setSel] = useState<Agent | null>(null);
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<Agent>>({});

  useEffect(() => {
    if (token) api.getAgents().then((a) => { setList(a); setSel(a.find((x) => x.active) ?? a[0] ?? null); });
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
    } finally {
      setThinking(false);
    }
  };

  const toggleActive = async (a: Agent) => {
    const updated = await api.updateAgent(a.id, { active: !a.active });
    setList((l) => l.map((x) => (x.id === updated.id ? updated : x)));
    if (sel?.id === a.id) setSel(updated);
  };

  const openEdit = (a: Agent) => {
    setEditDraft({ ...a });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editDraft.id) return;
    const updated = await api.updateAgent(editDraft.id, editDraft);
    setList((l) => l.map((x) => (x.id === updated.id ? updated : x)));
    if (sel?.id === updated.id) setSel(updated);
    setEditOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">AI Ajanlar</h1>
          <p className="text-xs text-text-dim">Claude · Gemini · GPT — LangGraph entegrasyonu</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ minHeight: 480 }}>
        <div className="bg-bg-elev border border-line rounded-xl overflow-hidden flex flex-col shadow-card">
          <div className="px-3 py-2 text-xs text-text-dim border-b border-line font-medium">
            Ajanlar ({list.filter((a) => a.active).length}/{list.length} aktif)
          </div>
          <ul className="divide-y divide-line flex-1 overflow-auto">
            {list.map((a) => (
              <li
                key={a.id}
                onClick={() => { setSel(a); setChat([]); }}
                className={`px-3 py-3 cursor-pointer transition ${sel?.id === a.id ? "bg-bg-soft" : "hover:bg-bg-soft/60"}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full grid place-items-center ${a.active ? "bg-accent/15" : "bg-bg-soft"}`}>
                    <Bot size={14} className={a.active ? "text-accent" : "text-text-dim"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text truncate">{a.name}</span>
                      {!a.active && <span className="text-[10px] text-text-dim">(pasif)</span>}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${PROVIDER_COLORS[a.provider]}`}>
                      {a.model.split("-").slice(0, 2).join("-")}
                    </span>
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
            ))}
          </ul>
        </div>

        <div className="md:col-span-2 bg-bg-elev border border-line rounded-xl flex flex-col overflow-hidden shadow-card">
          {sel ? (
            <>
              <div className="px-3 py-2.5 border-b border-line flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full grid place-items-center ${sel.active ? "bg-accent/15" : "bg-bg-soft"}`}>
                  <Bot size={12} className={sel.active ? "text-accent" : "text-text-dim"} />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-text">{sel.name}</span>
                  <span className="text-xs text-text-dim ml-2">{sel.role}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${PROVIDER_COLORS[sel.provider]}`}>
                    {PROVIDER_MODELS[sel.provider]?.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-soft text-text-dim border border-line">
                    {sel.model.split("-").slice(0, 3).join("-")}
                  </span>
                </div>
              </div>

              {chat.length === 0 && (
                <div className="px-3 pt-3 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
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

              <div className="flex-1 overflow-auto p-3 space-y-3">
                {chat.length === 0 && (
                  <div className="text-center text-text-dim text-sm py-6">
                    Ajana bir soru sor veya yukarıdan hızlı sorgu seç
                  </div>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-accent/15 grid place-items-center mr-2 shrink-0 mt-1">
                        <Bot size={12} className="text-accent" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-accent/10 text-text border border-accent/20"
                          : "bg-bg-soft text-text border border-line"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full bg-accent/15 grid place-items-center mr-2 shrink-0 mt-1">
                      <Bot size={12} className="text-accent" />
                    </div>
                    <div className="bg-bg-soft px-3 py-2 rounded-xl flex items-center gap-2 text-text-dim text-sm border border-line">
                      <Loader2 size={13} className="animate-spin" />
                      <span className="text-xs">{PROVIDER_MODELS[sel.provider]?.label} düşünüyor...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-line flex gap-2">
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); invoke(); } }}
                  rows={2}
                  placeholder={`${sel.name}'a komut/sorgu yaz... (Enter gönder)`}
                  className="flex-1 bg-bg-soft border border-line px-3 py-2 rounded-lg outline-none text-sm text-text resize-none placeholder:text-text-dim focus:border-accent"
                />
                <button
                  onClick={() => invoke()}
                  disabled={thinking || !msg.trim() || !sel.active}
                  className="w-10 h-10 self-end rounded-lg bg-accent text-white grid place-items-center hover:bg-amber-600 transition disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              </div>
              {!sel.active && (
                <div className="px-3 pb-2 text-center text-xs text-text-dim">
                  Bu ajan pasif — aktifleştirmek için soldaki ON düğmesine bas
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-text-dim text-sm">
              Soldan bir ajan seç
            </div>
          )}
        </div>
      </div>

      {editOpen && editDraft && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4" onClick={() => setEditOpen(false)}>
          <div className="bg-bg-elev border border-line rounded-xl p-5 w-full max-w-md space-y-3 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-accent" />
              <h2 className="font-semibold text-text">Ajan Düzenle</h2>
            </div>
            <div>
              <label className="text-xs text-text-dim">İsim</label>
              <input
                value={editDraft.name ?? ""}
                onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-text-dim">Rol / Açıklama</label>
              <input
                value={editDraft.role ?? ""}
                onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })}
                className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent"
              />
            </div>
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
                  className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none"
                >
                  {Object.entries(PROVIDER_MODELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-dim">Model</label>
                <select
                  value={editDraft.model ?? ""}
                  onChange={(e) => setEditDraft({ ...editDraft, model: e.target.value })}
                  className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none"
                >
                  {(PROVIDER_MODELS[editDraft.provider ?? "anthropic"]?.models ?? []).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-2 rounded-lg border border-line text-sm text-text-dim hover:bg-bg-soft transition">İptal</button>
              <button onClick={saveEdit} className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-amber-600 transition">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
