/**
 * /api/metrics — Prometheus-compatible metrics endpoint
 */
import { Router } from "express";
import { riskEngine } from "../lib/risk-engine.js";
import { strategyEngine } from "../lib/strategy-engine.js";
import { getAllGateways } from "../lib/binance-futures.js";
import { getClientCount, getAuthenticatedClientCount } from "../lib/ws-hub.js";

const router = Router();

function formatMetric(name: string, value: number, labels: Record<string, string> = {}, help?: string, type?: string): string {
  const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",");
  const labelPart = labelStr ? `{${labelStr}}` : "";
  const lines: string[] = [];
  if (help) lines.push(`# HELP ${name} ${help}`);
  if (type) lines.push(`# TYPE ${name} ${type}`);
  lines.push(`${name}${labelPart} ${value}`);
  return lines.join("\n");
}

router.get("/", async (_req, res) => {
  const risk = riskEngine.getSummary();
  const strategies = strategyEngine.getAll();
  const gateways = getAllGateways();

  const lines: string[] = [
    "# Nexus Trade OS Metrics",
    "",
    formatMetric("nexus_ws_clients_total", getClientCount(), {}, "Total WebSocket clients", "gauge"),
    formatMetric("nexus_ws_clients_authenticated", getAuthenticatedClientCount(), {}, "Authenticated WebSocket clients", "gauge"),
    "",
    formatMetric("nexus_risk_kill_switch_active", risk.killSwitchActive ? 1 : 0, {}, "Kill switch status", "gauge"),
    formatMetric("nexus_risk_daily_pnl_pct", risk.dailyPnlPct, {}, "Daily PnL percentage", "gauge"),
    formatMetric("nexus_risk_daily_pnl_usd", risk.dailyPnlUsd, {}, "Daily PnL USD", "gauge"),
    formatMetric("nexus_risk_drawdown_pct", risk.drawdownPct, {}, "Current drawdown percentage", "gauge"),
    formatMetric("nexus_risk_open_positions", risk.openPositions, {}, "Open positions count", "gauge"),
    formatMetric("nexus_risk_consecutive_losses", risk.consecutiveLosses, {}, "Consecutive losses", "gauge"),
    formatMetric("nexus_risk_total_exposure_usd", risk.totalExposureUsd, {}, "Total exposure USD", "gauge"),
    "",
    "# HELP nexus_strategy_signals_total Total signals generated per strategy",
    "# TYPE nexus_strategy_signals_total counter",
    ...strategies.map((s) => `nexus_strategy_signals_total{strategy="${s.name}",kind="${s.kind}"} ${s.signalCount}`),
    "",
    "# HELP nexus_strategy_errors_total Total errors per strategy",
    "# TYPE nexus_strategy_errors_total counter",
    ...strategies.map((s) => `nexus_strategy_errors_total{strategy="${s.name}"} ${s.errorCount}`),
    "",
    "# HELP nexus_strategy_status Strategy status (1=running, 0=idle, -1=error)",
    "# TYPE nexus_strategy_status gauge",
    ...strategies.map((s) => {
      const val = s.status === "running" ? 1 : s.status === "error" ? -1 : 0;
      return `nexus_strategy_status{strategy="${s.name}"} ${val}`;
    }),
    "",
    "# HELP nexus_gateway_connected Gateway connection status",
    "# TYPE nexus_gateway_connected gauge",
  ];

  for (const [id, gw] of gateways) {
    const status = gw.getStatus();
    lines.push(`nexus_gateway_connected{exchange_id="${id}",mode="${status.mode}"} ${status.connected ? 1 : 0}`);
    lines.push(`nexus_gateway_latency_ms{exchange_id="${id}"} ${status.latencyMs}`);
  }

  res.set("Content-Type", "text/plain; version=0.0.4");
  res.send(lines.join("\n") + "\n");
});

export default router;
