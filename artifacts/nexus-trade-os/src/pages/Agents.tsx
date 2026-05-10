import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, Agent } from "@/lib/api";
import { Bot, Send, Loader2 } from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; text: string };

export default function Agents() {
  const token = useStore((s) => s.token);
  const [list, setList] = useState<Agent[]>([]);
  const [sel, setSel] = useState<Agent | null>(null);
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    if (token) api.getAgents().then((a) => { setList(a); setSel(a[0] ?? null); });
  }, [token]);

  const invoke = async () => {
    if (!sel || !msg.trim()) return;
    const userMsg = msg.trim();
    setMsg("");
    setChat((c) => [...c, { role: "user", text: userMsg }]);
    setThinking(true);
    try {
      const r = await api.invokeAgent(sel.id, userMsg);
      setChat((c) => [...c, { role: "assistant", text: r.reply }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-text">AI Ajanlar</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-[calc(100vh-200px)] min-h-[400px]">
        <div className="bg-bg-elev border border-line rounded-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2 text-xs text-text-dim border-b border-line">Ajanlar</div>
          <ul className="divide-y divide-line flex-1 overflow-auto">
            {list.map((a) => (
              <li
                key={a.id}
                onClick={() => { setSel(a); setChat([]); }}
                className={`px-3 py-3 cursor-pointer transition ${sel?.id === a.id ? "bg-bg-soft" : "hover:bg-bg-soft/50"}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent/20 grid place-items-center">
                    <Bot size={14} className="text-accent" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text">{a.name}</div>
                    <div className="text-xs text-text-dim">{a.provider} · {a.model}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2 bg-bg-elev border border-line rounded-xl flex flex-col overflow-hidden">
          {sel ? (
            <>
              <div className="px-3 py-2 border-b border-line flex items-center gap-2">
                <Bot size={14} className="text-accent" />
                <span className="text-sm font-medium text-text">{sel.name}</span>
                <span className="text-xs text-text-dim ml-auto">{sel.provider} / {sel.model}</span>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-3">
                {chat.length === 0 && (
                  <div className="text-center text-text-dim text-sm py-8">
                    Ajana bir soru sor veya analiz isteğinde bulun
                  </div>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                        m.role === "user" ? "bg-accent/20 text-text" : "bg-bg-soft text-text"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="bg-bg-soft px-3 py-2 rounded-xl flex items-center gap-2 text-text-dim text-sm">
                      <Loader2 size={13} className="animate-spin" /> Düşünüyor...
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
                  placeholder="Ajana komut/sorgu yaz... (Enter gönd)"
                  className="flex-1 bg-bg-soft px-3 py-2 rounded outline-none text-sm text-text resize-none placeholder:text-text-dim"
                />
                <button
                  onClick={invoke}
                  disabled={thinking || !msg.trim()}
                  className="w-10 h-10 self-end rounded-lg bg-accent text-[#0b0e11] grid place-items-center hover:bg-accent/90 transition disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-text-dim text-sm">
              Soldan bir ajan seç
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
