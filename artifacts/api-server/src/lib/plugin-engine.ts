/**
 * Nexus Trade OS — Plugin Engine
 * Hot-loadable, sandboxed plugin runtime with event bus.
 * Plugins can hook into: onTick, onSignal, beforeOrder, afterOrder, onBalance, onPnLSnapshot
 */

import { EventEmitter } from "events";
import { logger } from "./logger.js";

// ── Plugin Types ──────────────────────────────────────────────────────────

export type PluginHook =
  | "onTick"
  | "onSignal"
  | "beforeOrder"
  | "afterOrder"
  | "onBalance"
  | "onPnLSnapshot"
  | "onPositionUpdate"
  | "onKillSwitch";

export type PluginKind =
  | "data_feed"
  | "strategy"
  | "risk_engine"
  | "notification"
  | "llm_provider"
  | "exchange_adapter";

export interface PluginPermissions {
  canReadTicks: boolean;
  canReadSignals: boolean;
  canReadPositions: boolean;
  canReadOrders: boolean;
  canReadBalance: boolean;
  canPlaceOrders: boolean;
  canModifyRisk: boolean;
  canAccessAI: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  kind: PluginKind;
  hooks: PluginHook[];
  permissions: Partial<PluginPermissions>;
  configSchema?: Array<{
    key: string;
    label: string;
    type: "string" | "number" | "boolean";
    required: boolean;
    default?: unknown;
  }>;
}

export interface PluginInstance {
  manifest: PluginManifest;
  config: Record<string, unknown>;
  status: "enabled" | "disabled" | "error" | "loading";
  errorMessage?: string;
  loadedAt: number;
  lastEventAt: number;
  eventCount: number;
  handlers: Partial<Record<PluginHook, PluginHandler>>;
}

export type PluginHandler = (data: unknown, ctx: PluginContext) => Promise<unknown> | unknown;

export interface PluginContext {
  pluginId: string;
  config: Record<string, unknown>;
  log: (msg: string, data?: unknown) => void;
  emit: (event: string, data: unknown) => void;
}

// ── Built-in Plugin Definitions ───────────────────────────────────────────

const BUILT_IN_MANIFESTS: PluginManifest[] = [
  {
    id: "nexus-binance-feed",
    name: "Binance Futures Feed",
    version: "1.0.0",
    description: "Real-time Binance USDM Futures mark prices via WebSocket",
    author: "Nexus Core",
    kind: "data_feed",
    hooks: ["onTick"],
    permissions: { canReadTicks: true },
  },
  {
    id: "nexus-risk-engine",
    name: "Nexus Risk Engine",
    version: "1.0.0",
    description: "Institutional risk management: SL/TP/trailing stop/kill switch",
    author: "Nexus Core",
    kind: "risk_engine",
    hooks: ["beforeOrder", "onPositionUpdate", "onKillSwitch"],
    permissions: { canReadPositions: true, canReadBalance: true, canModifyRisk: true },
  },
  {
    id: "nexus-strategy-engine",
    name: "Strategy Engine",
    version: "1.0.0",
    description: "Multi-strategy signal generation with RSI/EMA/MACD/BB/VWAP",
    author: "Nexus Core",
    kind: "strategy",
    hooks: ["onTick", "onSignal"],
    permissions: { canReadTicks: true, canReadSignals: true },
  },
  {
    id: "nexus-telegram",
    name: "Telegram Approval Bot",
    version: "1.0.0",
    description: "Human-in-the-loop trade approval via Telegram",
    author: "Nexus Core",
    kind: "notification",
    hooks: ["beforeOrder", "afterOrder"],
    permissions: { canReadOrders: true },
    configSchema: [
      { key: "bot_token", label: "Bot Token", type: "string", required: true },
      { key: "chat_id", label: "Chat ID", type: "string", required: true },
      { key: "require_approval", label: "Require Approval", type: "boolean", required: false, default: true },
    ],
  },
  {
    id: "nexus-pnl-tracker",
    name: "PnL Tracker",
    version: "1.0.0",
    description: "Automatic PnL snapshots and equity curve tracking",
    author: "Nexus Core",
    kind: "data_feed",
    hooks: ["onPnLSnapshot", "onBalance"],
    permissions: { canReadBalance: true },
  },
];

// ── Plugin Engine ─────────────────────────────────────────────────────────

export class PluginEngine extends EventEmitter {
  private plugins = new Map<string, PluginInstance>();
  private eventBus = new EventEmitter();

  constructor() {
    super();
    this.loadBuiltIns();
  }

  private loadBuiltIns() {
    for (const manifest of BUILT_IN_MANIFESTS) {
      this.plugins.set(manifest.id, {
        manifest,
        config: {},
        status: "enabled",
        loadedAt: Date.now(),
        lastEventAt: 0,
        eventCount: 0,
        handlers: {},
      });
    }
    logger.info({ count: BUILT_IN_MANIFESTS.length }, "Built-in plugins loaded");
  }

  // ── Plugin Management ─────────────────────────────────────────────────────

  async installPlugin(manifest: PluginManifest, config: Record<string, unknown> = {}): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      await this.uninstallPlugin(manifest.id);
    }

    const instance: PluginInstance = {
      manifest,
      config,
      status: "loading",
      loadedAt: Date.now(),
      lastEventAt: 0,
      eventCount: 0,
      handlers: {},
    };

    this.plugins.set(manifest.id, instance);

    try {
      // Validate config
      this.validateConfig(manifest, config);
      instance.status = "enabled";
      logger.info({ id: manifest.id, name: manifest.name }, "Plugin installed");
      this.emit("pluginInstalled", { id: manifest.id, name: manifest.name });
    } catch (err) {
      instance.status = "error";
      instance.errorMessage = String(err);
      logger.error({ err, id: manifest.id }, "Plugin install failed");
    }
  }

  async uninstallPlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    plugin.status = "disabled";
    this.plugins.delete(id);
    logger.info({ id }, "Plugin uninstalled");
    this.emit("pluginUninstalled", { id });
  }

  enablePlugin(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin ${id} not found`);
    plugin.status = "enabled";
    this.emit("pluginEnabled", { id });
  }

  disablePlugin(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin ${id} not found`);
    plugin.status = "disabled";
    this.emit("pluginDisabled", { id });
  }

  updatePluginConfig(id: string, config: Record<string, unknown>): void {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin ${id} not found`);
    this.validateConfig(plugin.manifest, config);
    plugin.config = { ...plugin.config, ...config };
    this.emit("pluginConfigUpdated", { id, config });
  }

  registerHandler(pluginId: string, hook: PluginHook, handler: PluginHandler): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);
    if (!plugin.manifest.hooks.includes(hook)) {
      throw new Error(`Plugin ${pluginId} does not declare hook ${hook}`);
    }
    plugin.handlers[hook] = handler;
  }

  // ── Event Dispatch ────────────────────────────────────────────────────────

  async dispatch(hook: PluginHook, data: unknown): Promise<unknown[]> {
    const results: unknown[] = [];

    for (const [id, plugin] of this.plugins) {
      if (plugin.status !== "enabled") continue;
      if (!plugin.manifest.hooks.includes(hook)) continue;

      const handler = plugin.handlers[hook];
      if (!handler) continue;

      const ctx: PluginContext = {
        pluginId: id,
        config: plugin.config,
        log: (msg, extra) => logger.info({ plugin: id, ...(extra as object) }, msg),
        emit: (event, eventData) => this.eventBus.emit(event, eventData),
      };

      try {
        const result = await handler(data, ctx);
        results.push(result);
        plugin.lastEventAt = Date.now();
        plugin.eventCount++;
      } catch (err) {
        logger.error({ err, pluginId: id, hook }, "Plugin handler error");
        plugin.errorMessage = String(err);
      }
    }

    return results;
  }

  // ── beforeOrder hook — can block/modify orders ────────────────────────────

  async runBeforeOrder(orderParams: Record<string, unknown>): Promise<{
    approved: boolean;
    modifiedParams: Record<string, unknown>;
    reasons: string[];
  }> {
    let approved = true;
    let modifiedParams = { ...orderParams };
    const reasons: string[] = [];

    for (const [id, plugin] of this.plugins) {
      if (plugin.status !== "enabled") continue;
      if (!plugin.manifest.hooks.includes("beforeOrder")) continue;
      if (!plugin.manifest.permissions?.canPlaceOrders && !plugin.manifest.permissions?.canReadOrders) continue;

      const handler = plugin.handlers["beforeOrder"];
      if (!handler) continue;

      const ctx: PluginContext = {
        pluginId: id,
        config: plugin.config,
        log: (msg, extra) => logger.info({ plugin: id, ...(extra as object) }, msg),
        emit: (event, eventData) => this.eventBus.emit(event, eventData),
      };

      try {
        const result = await handler(modifiedParams, ctx) as {
          approved?: boolean;
          params?: Record<string, unknown>;
          reason?: string;
        } | undefined;

        if (result) {
          if (result.approved === false) {
            approved = false;
            if (result.reason) reasons.push(`[${plugin.manifest.name}] ${result.reason}`);
          }
          if (result.params) {
            modifiedParams = { ...modifiedParams, ...result.params };
          }
        }
      } catch (err) {
        logger.error({ err, pluginId: id }, "beforeOrder plugin error");
      }
    }

    return { approved, modifiedParams, reasons };
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private validateConfig(manifest: PluginManifest, config: Record<string, unknown>): void {
    if (!manifest.configSchema) return;
    for (const field of manifest.configSchema) {
      if (field.required && !config[field.key]) {
        throw new Error(`Required config field missing: ${field.key} (${field.label})`);
      }
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getAll(): PluginInstance[] {
    return [...this.plugins.values()];
  }

  get(id: string): PluginInstance | undefined {
    return this.plugins.get(id);
  }

  getEventBus(): EventEmitter {
    return this.eventBus;
  }
}

// Singleton
export const pluginEngine = new PluginEngine();
