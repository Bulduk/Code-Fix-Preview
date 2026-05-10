import { useStore } from "@/lib/store";
import { useState } from "react";
import { MessageSquare, Check, Bell, BellOff, Send, Clock } from "lucide-react";
import { api } from "@/lib/api";

export default function TelegramSettings() {
  const { telegramEnabled, telegramChatId, pendingApprovals,
    setTelegramEnabled, setTelegramChatId, resolveApproval } = useStore();

  const [chatInput, setChatInput] = useState(telegramChatId);
  const [testSent, setTestSent] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const save = () => {
    setTelegramChatId(chatInput);
  };

  const sendTest = async () => {
    if (!chatInput) return;
    setTestLoading(true);
    await api.sendTelegramApproval(chatInput, { sym: "BTCUSDT", side: "buy", confidence: 0.82 });
    setTestLoading(false);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const pending = pendingApprovals.filter((a) => !a.answer);
  const resolved = pendingApprovals.filter((a) => a.answer);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text">Telegram — Human-in-the-Loop</h1>

      <div className="bg-bg-elev border border-line rounded-xl p-4 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text">Telegram Onay Mekanizması</div>
            <div className="text-xs text-text-dim">Orkestratör karar vermeden önce onay gönderir</div>
          </div>
          <button
            onClick={() => setTelegramEnabled(!telegramEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              telegramEnabled ? "bg-up/10 text-up border border-up/30" : "bg-bg-soft text-text-dim border border-line"
            }`}
          >
            {telegramEnabled ? <><Bell size={13} /> Aktif</> : <><BellOff size={13} /> Pasif</>}
          </button>
        </div>

        <div>
          <label className="text-xs text-text-dim block mb-1">Bot Chat ID</label>
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="-1001234567890"
              className="flex-1 bg-bg-soft border border-line rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent font-mono"
            />
            <button
              onClick={save}
              className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-amber-600 transition"
            >
              <Check size={14} />
            </button>
          </div>
          <p className="text-[11px] text-text-dim mt-1">
            Telegram @userinfobot ile Chat ID öğren. Bot token .env dosyasında TELEGRAM_BOT_TOKEN.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={sendTest}
            disabled={!chatInput || testLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line bg-bg-soft text-sm text-text hover:bg-line transition disabled:opacity-40"
          >
            {testLoading ? <Clock size={13} className="animate-spin" /> : <Send size={13} />}
            {testSent ? "Gönderildi!" : "Test Mesajı Gönder"}
          </button>
        </div>
      </div>

      <div className="bg-bg-elev border border-line rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <span className="text-sm font-medium text-text">Bekleyen Onaylar</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${pending.length > 0 ? "bg-amber-100 text-amber-700" : "bg-bg-soft text-text-dim"}`}>
            {pending.length}
          </span>
        </div>
        <div className="divide-y divide-line">
          {pending.length === 0 && (
            <div className="px-4 py-6 text-center text-text-dim text-sm">Bekleyen onay yok</div>
          )}
          {pending.map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare size={13} className="text-accent" />
                  <span className="font-mono text-sm text-text">{a.decision.sym}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${a.decision.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {a.decision.side.toUpperCase()}
                  </span>
                  <span className="text-xs text-text-dim">%{(a.decision.confidence * 100).toFixed(1)}</span>
                </div>
                <span className="text-[10px] text-text-dim">{new Date(a.sentAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => resolveApproval(a.id, "approve")}
                  className="flex-1 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition"
                >
                  ✅ Onayla
                </button>
                <button
                  onClick={() => resolveApproval(a.id, "reject")}
                  className="flex-1 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition"
                >
                  ❌ Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {resolved.length > 0 && (
        <div className="bg-bg-elev border border-line rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <span className="text-sm font-medium text-text">Yanıtlananlar</span>
          </div>
          <div className="divide-y divide-line">
            {resolved.slice(0, 10).map((a) => (
              <div key={a.id} className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text">{a.decision.sym}</span>
                  <span className={`text-xs ${a.decision.side === "buy" ? "text-up" : "text-down"}`}>{a.decision.side.toUpperCase()}</span>
                </div>
                <span className={`text-xs font-medium ${a.answer === "approve" ? "text-up" : "text-down"}`}>
                  {a.answer === "approve" ? "✅ Onaylandı" : "❌ Reddedildi"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-bg-elev border border-line rounded-xl p-4 shadow-card">
        <div className="text-xs font-medium text-text-dim mb-3">Mesaj Formatı (Örnek)</div>
        <div className="bg-slate-50 rounded-lg p-3 font-mono text-xs text-slate-700 space-y-1">
          <div>🤖 <b>Nexus Trade OS</b></div>
          <div>━━━━━━━━━━━━━━━━━</div>
          <div>📊 Sembol: <b>BTCUSDT</b></div>
          <div>📈 Yön: <b>BUY</b></div>
          <div>🎯 Güven: <b>%82.4</b></div>
          <div>⚡ Risk: <b>ONAYLANDI</b></div>
          <div>━━━━━━━━━━━━━━━━━</div>
          <div>✅ /approve_{"<id>"}</div>
          <div>❌ /reject_{"<id>"}</div>
        </div>
      </div>
    </div>
  );
}
