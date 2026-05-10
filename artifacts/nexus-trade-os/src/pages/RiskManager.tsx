import { useStore } from "@/lib/store";
import { Shield, AlertTriangle, Save, RotateCcw } from "lucide-react";
import { useState } from "react";

type SliderRowProps = {
  label: string; hint: string; value: number;
  min: number; max: number; step: number; unit: string;
  color?: string;
  onChange: (v: number) => void;
};

function SliderRow({ label, hint, value, min, max, step, unit, color = "bg-accent", onChange }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-text">{label}</div>
          <div className="text-xs text-text-dim">{hint}</div>
        </div>
        <div className="text-sm font-semibold text-text tabular-nums">
          {value}{unit}
        </div>
      </div>
      <div className="relative h-2 bg-bg-soft rounded-full">
        <div className={`absolute left-0 top-0 h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-dim">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function RiskManager() {
  const { riskConfig, setRiskConfig } = useStore();
  const [draft, setDraft] = useState({ ...riskConfig });
  const [saved, setSaved] = useState(false);

  const set = (key: keyof typeof draft) => (v: number) => setDraft((d) => ({ ...d, [key]: v }));

  const save = () => {
    setRiskConfig(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => setDraft({ ...riskConfig });

  const riskScore = Math.min(100, Math.round(
    (draft.maxPositionPct / 20) * 25 +
    (1 - draft.stopLossPct / 10) * 25 +
    (draft.maxDailyLossPct / 20) * 25 +
    (draft.maxOpenPositions / 10) * 25
  ));

  const riskLabel = riskScore < 35 ? { text: "Düşük Risk", color: "text-up" }
    : riskScore < 65 ? { text: "Orta Risk", color: "text-amber-600" }
    : { text: "Yüksek Risk", color: "text-down" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text">Risk Yöneticisi</h1>
          <p className="text-xs text-text-dim">Rust katmanında doğrulanır — tüm stratejilere uygulanır</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-bg-elev text-sm text-text-dim hover:text-text transition">
            <RotateCcw size={13} /> Sıfırla
          </button>
          <button
            onClick={save}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition ${saved ? "bg-up text-white" : "bg-accent text-white hover:bg-amber-600"}`}
          >
            <Save size={13} /> {saved ? "Kaydedildi!" : "Kaydet"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-bg-elev border border-line rounded-xl p-4 shadow-card space-y-5">
            <div className="text-xs font-medium text-text-dim uppercase tracking-wide">Pozisyon Limitleri</div>
            <SliderRow
              label="Max Pozisyon Büyüklüğü" hint="Toplam sermayenin yüzdesi"
              value={draft.maxPositionPct} min={0.5} max={20} step={0.5} unit="%"
              color="bg-blue-400"
              onChange={set("maxPositionPct")}
            />
            <SliderRow
              label="İşlem Başına Risk" hint="Her işlemde riske atılacak sermaye"
              value={draft.riskPerTradePct} min={0.1} max={5} step={0.1} unit="%"
              color="bg-accent"
              onChange={set("riskPerTradePct")}
            />
            <SliderRow
              label="Max Açık Pozisyon" hint="Aynı anda açık tutulabilecek maksimum pozisyon"
              value={draft.maxOpenPositions} min={1} max={20} step={1} unit=" adet"
              color="bg-purple-400"
              onChange={set("maxOpenPositions")}
            />
          </div>

          <div className="bg-bg-elev border border-line rounded-xl p-4 shadow-card space-y-5">
            <div className="text-xs font-medium text-text-dim uppercase tracking-wide">Stop-Loss / Take-Profit (Varsayılan)</div>
            <SliderRow
              label="Stop-Loss" hint="Pozisyon başına maksimum kayıp"
              value={draft.stopLossPct} min={0.2} max={10} step={0.1} unit="%"
              color="bg-down"
              onChange={set("stopLossPct")}
            />
            <SliderRow
              label="Take-Profit" hint="Hedef kâr seviyesi"
              value={draft.takeProfitPct} min={0.5} max={30} step={0.5} unit="%"
              color="bg-up"
              onChange={set("takeProfitPct")}
            />
            <SliderRow
              label="Max Günlük Kayıp" hint="Bu limite ulaşıldığında tüm işlemler durdurulur"
              value={draft.maxDailyLossPct} min={1} max={25} step={0.5} unit="%"
              color="bg-red-400"
              onChange={set("maxDailyLossPct")}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-bg-elev border border-line rounded-xl p-4 shadow-card">
            <div className="text-xs font-medium text-text-dim mb-3">Risk Skoru</div>
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#eef1f6" strokeWidth="12" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={riskScore < 35 ? "#16a34a" : riskScore < 65 ? "#d97706" : "#dc2626"}
                    strokeWidth="12"
                    strokeDasharray={`${riskScore * 2.51} 251`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-text">{riskScore}</span>
                </div>
              </div>
              <span className={`text-sm font-semibold ${riskLabel.color}`}>{riskLabel.text}</span>
            </div>
          </div>

          <div className="bg-bg-elev border border-line rounded-xl p-4 shadow-card space-y-3">
            <div className="text-xs font-medium text-text-dim">Aktif Limitler</div>
            {[
              { label: "SL", value: `${draft.stopLossPct}%`, color: "text-down" },
              { label: "TP", value: `${draft.takeProfitPct}%`, color: "text-up" },
              { label: "Max Pos", value: `${draft.maxPositionPct}%`, color: "text-accent" },
              { label: "Günlük", value: `${draft.maxDailyLossPct}%`, color: "text-down" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-sm text-text-dim">{r.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${r.color}`}>{r.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Limitler Rust katmanında gerçek zamanlı doğrulanır. Ayarlar her yeni işlemde uygulanır.
            </p>
          </div>

          <div className="bg-bg-elev border border-line rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={13} className="text-accent" />
              <span className="text-xs font-medium text-text">Rust Risk Engine</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Aktif</span>
            </div>
            <div className="text-xs text-text-dim space-y-1">
              <div>• Polars DataFrame risk hesabı</div>
              <div>• PyO3 Python köprüsü</div>
              <div>• Ortalama yanıt: ~8ms</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
