/**
 * Nexus Trade OS — Plugin SDK
 * Use this to build custom plugins for the Nexus ecosystem.
 *
 * @example
 * ```typescript
 * import { definePlugin, type PluginContext } from "@nexus/plugin-sdk";
 *
 * export default definePlugin({
 *   manifest: {
 *     id: "my-strategy",
 *     name: "My Custom Strategy",
 *     version: "1.0.0",
 *     description: "Custom EMA strategy",
 *     author: "Your Name",
 *     kind: "strategy",
 *     hooks: ["onTick", "onSignal"],
 *     permissions: { canReadTicks: true, canReadSignals: true },
 *   },
 *   handlers: {
 *     onTick: async (data, ctx) => {
 *       ctx.log("Tick received", data);
 *     },
 *     onSignal: async (signal, ctx) => {
 *       ctx.log("Signal received", signal);
 *     },
 *   },
 * });
 * ```
 */

export type { PluginManifest, PluginHook, PluginKind, PluginPermissions, PluginContext, PluginHandler } from "./plugin-engine.js";

export interface PluginDefinition {
  manifest: import("./plugin-engine.js").PluginManifest;
  handlers: Partial<Record<import("./plugin-engine.js").PluginHook, import("./plugin-engine.js").PluginHandler>>;
  onLoad?: (config: Record<string, unknown>) => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
}

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return definition;
}

// ── SDK Utilities ─────────────────────────────────────────────────────────

export interface TickData {
  symbol: string;
  markPrice: number;
  fundingRate?: number;
  ts: number;
}

export interface SignalData {
  strategyId: string;
  strategyName: string;
  symbol: string;
  side: "buy" | "sell";
  strength: number;
  confidence: number;
  reasons: string[];
  indicators: Record<string, number>;
  suggestedEntry: number;
  suggestedSL: number;
  suggestedTP: number;
  suggestedQty: number;
  ts: number;
}

export interface OrderData {
  symbol: string;
  side: "buy" | "sell";
  type: string;
  amount: number;
  price?: number;
  stopPrice?: number;
  reduceOnly?: boolean;
}

export interface BalanceData {
  totalWalletBalance: number;
  totalUnrealizedProfit: number;
  availableBalance: number;
}

export interface PnLSnapshotData {
  equity: number;
  totalBalance: number;
  unrealized: number;
  realized: number;
  ts: number;
}

// ── Example Plugins ───────────────────────────────────────────────────────

export const EXAMPLE_TELEGRAM_PLUGIN: PluginDefinition = {
  manifest: {
    id: "custom-telegram-alerts",
    name: "Custom Telegram Alerts",
    version: "1.0.0",
    description: "Send custom alerts to Telegram on strong signals",
    author: "Custom",
    kind: "notification",
    hooks: ["onSignal", "afterOrder"],
    permissions: { canReadSignals: true, canReadOrders: true },
    configSchema: [
      { key: "bot_token", label: "Bot Token", type: "string", required: true },
      { key: "chat_id", label: "Chat ID", type: "string", required: true },
      { key: "min_strength", label: "Min Signal Strength", type: "number", required: false, default: 0.75 },
    ],
  },
  handlers: {
    onSignal: async (data, ctx) => {
      const signal = data as SignalData;
      const minStrength = (ctx.config["min_strength"] as number) ?? 0.75;

      if (signal.strength < minStrength) return;

      const botToken = ctx.config["bot_token"] as string;
      const chatId = ctx.config["chat_id"] as string;

      if (!botToken || !chatId) {
        ctx.log("Telegram not configured");
        return;
      }

      const emoji = signal.side === "buy" ? "🟢" : "🔴";
      const text = `${emoji} *${signal.symbol}* ${signal.side.toUpperCase()}\n` +
        `Strength: ${(signal.strength * 100).toFixed(0)}%\n` +
        `Entry: $${signal.suggestedEntry.toFixed(2)}\n` +
        `SL: $${signal.suggestedSL.toFixed(2)} | TP: $${signal.suggestedTP.toFixed(2)}\n` +
        `Reason: ${signal.reasons.slice(0, 2).join(", ")}`;

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
        });
        ctx.log("Telegram alert sent", { symbol: signal.symbol });
      } catch (err) {
        ctx.log("Telegram send failed", { err: String(err) });
      }
    },
  },
};

export const EXAMPLE_RISK_PLUGIN: PluginDefinition = {
  manifest: {
    id: "custom-risk-filter",
    name: "Custom Risk Filter",
    version: "1.0.0",
    description: "Block orders during high volatility periods",
    author: "Custom",
    kind: "risk_engine",
    hooks: ["beforeOrder"],
    permissions: { canReadTicks: true },
    configSchema: [
      { key: "max_atr_multiplier", label: "Max ATR Multiplier", type: "number", required: false, default: 3 },
    ],
  },
  handlers: {
    beforeOrder: async (data, ctx) => {
      const order = data as OrderData;
      const maxAtr = (ctx.config["max_atr_multiplier"] as number) ?? 3;

      // Example: block orders if ATR is too high
      ctx.log("Risk filter checking order", { symbol: order.symbol });

      // Return approval
      return { approved: true };
    },
  },
};
