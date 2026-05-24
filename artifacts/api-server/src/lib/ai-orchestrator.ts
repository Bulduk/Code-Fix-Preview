/**
 * Nexus Trade OS — AI Multi-Agent Orchestrator
 * Real LangGraph-style multi-agent system with:
 * - Market Agent, Trend Agent, Volatility Agent, Risk Agent
 * - Sentiment Agent, Execution Agent, Portfolio Agent
 * - Weighted voting, confidence scoring, memory, reasoning logs
 */

import { EventEmitter } from "events";
import { logger } from "./logger.js";
import { scoreSignal, type OHLCV } from "./indicators.js";
import { riskEngine } from "./risk-engine.js";

// ── Types ─────────────────────────────────────────────────────────────────

export type AgentRole =
  | "market"
  | "trend"
  | "volatility"
  | "risk"
  | "sentiment"
  | "execution"
  | "portfolio";

export type LLMProvider = "anthropic" | "google" | "openai";

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  provider: LLMProvider;
  model: string;
  weight: number;  // voting weight 0-1
  enabled: boolean;
  systemPrompt?: string;
}

export interface AgentDecision {
  agentId: string;
  agentName: string;
  role: AgentRole;
  direction: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string;
  indicators?: Record<string, number>;
  latencyMs: number;
  ts: number;
}

export interface OrchestratorResult {
  id: string;
  symbol: string;
  finalDecision: "buy" | "sell" | "hold";
  confidence: number;
  weightedScore: number;
  agentDecisions: AgentDecision[];
  reasoning: string;
  riskApproved: boolean;
  riskReasons: string[];
  suggestedEntry: number;
  suggestedSL: number;
  suggestedTP: number;
  suggestedQty: number;
  requiresApproval: boolean;
  latencyMs: number;
  ts: number;
}

export interface OrchMemoryEntry {
  symbol: string;
  decision: OrchestratorResult;
  outcome?: "win" | "loss" | "pending";
  pnl?: number;
  ts: number;
}

// ── Default Agent Configs ─────────────────────────────────────────────────

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: "market-agent",
    name: "Market Agent",
    role: "market",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    weight: 0.20,
    enabled: true,
    systemPrompt: "You are a market microstructure expert. Analyze order flow, bid-ask spread, and market depth.",
  },
  {
    id: "trend-agent",
    name: "Trend Agent",
    role: "trend",
    provider: "anthropic",
    model: "claude-3-5-haiku-20241022",
    weight: 0.20,
    enabled: true,
    systemPrompt: "You are a trend analysis expert. Focus on EMA crossovers, momentum, and trend strength.",
  },
  {
    id: "volatility-agent",
    name: "Volatility Agent",
    role: "volatility",
    provider: "google",
    model: "gemini-1.5-flash",
    weight: 0.15,
    enabled: true,
    systemPrompt: "You are a volatility expert. Analyze ATR, Bollinger Bands, and volatility regimes.",
  },
  {
    id: "risk-agent",
    name: "Risk Agent",
    role: "risk",
    provider: "anthropic",
    model: "claude-3-5-haiku-20241022",
    weight: 0.20,
    enabled: true,
    systemPrompt: "You are a risk management expert. Evaluate position sizing, drawdown risk, and portfolio exposure.",
  },
  {
    id: "sentiment-agent",
    name: "Sentiment Agent",
    role: "sentiment",
    provider: "openai",
    model: "gpt-4o-mini",
    weight: 0.10,
    enabled: false,
    systemPrompt: "You are a market sentiment expert. Analyze funding rates, long/short ratios, and fear/greed.",
  },
  {
    id: "execution-agent",
    name: "Execution Agent",
    role: "execution",
    provider: "anthropic",
    model: "claude-3-5-haiku-20241022",
    weight: 0.10,
    enabled: true,
    systemPrompt: "You are an execution expert. Determine optimal entry timing, order type, and slippage management.",
  },
  {
    id: "portfolio-agent",
    name: "Portfolio Agent",
    role: "portfolio",
    provider: "google",
    model: "gemini-1.5-pro",
    weight: 0.05,
    enabled: false,
    systemPrompt: "You are a portfolio manager. Evaluate correlation, diversification, and overall portfolio health.",
  },
];

// ── LLM Client ────────────────────────────────────────────────────────────

async function callLLM(
  provider: LLMProvider,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = provider === "anthropic"
    ? process.env["ANTHROPIC_API_KEY"]
    : provider === "google"
    ? process.env["GEMINI_API_KEY"]
    : process.env["OPENAI_API_KEY"];

  if (!apiKey) {
    // Fallback to deterministic analysis when no API key
    return generateFallbackAnalysis(userPrompt);
  }

  try {
    if (provider === "anthropic") {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      const data = await resp.json() as { content?: Array<{ text: string }> };
      return data.content?.[0]?.text ?? generateFallbackAnalysis(userPrompt);
    }

    if (provider === "google") {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { maxOutputTokens: 512 },
          }),
        }
      );
      const data = await resp.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? generateFallbackAnalysis(userPrompt);
    }

    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      const data = await resp.json() as { choices?: Array<{ message: { content: string } }> };
      return data.choices?.[0]?.message?.content ?? generateFallbackAnalysis(userPrompt);
    }
  } catch (err) {
    logger.warn({ err, provider }, "LLM call failed, using fallback");
  }

  return generateFallbackAnalysis(userPrompt);
}

function generateFallbackAnalysis(prompt: string): string {
  // Deterministic technical analysis based on indicators in prompt
  const hasBullish = prompt.includes("RSI oversold") || prompt.includes("EMA bullish") || prompt.includes("MACD bullish");
  const hasBearish = prompt.includes("RSI overbought") || prompt.includes("EMA bearish") || prompt.includes("MACD bearish");

  if (hasBullish && !hasBearish) {
    return `DECISION: BUY | CONFIDENCE: 0.72 | REASONING: Technical indicators show bullish momentum with oversold conditions and positive trend alignment. Risk/reward ratio favorable.`;
  }
  if (hasBearish && !hasBullish) {
    return `DECISION: SELL | CONFIDENCE: 0.68 | REASONING: Technical indicators show bearish momentum with overbought conditions and negative trend alignment. Downside risk elevated.`;
  }
  return `DECISION: HOLD | CONFIDENCE: 0.55 | REASONING: Mixed signals detected. Insufficient confluence for high-confidence trade. Waiting for clearer setup.`;
}

function parseAgentResponse(response: string): { direction: "buy" | "sell" | "hold"; confidence: number; reasoning: string } {
  const upper = response.toUpperCase();

  let direction: "buy" | "sell" | "hold" = "hold";
  if (upper.includes("DECISION: BUY") || upper.includes("SIGNAL: BUY") || upper.includes("RECOMMENDATION: BUY")) {
    direction = "buy";
  } else if (upper.includes("DECISION: SELL") || upper.includes("SIGNAL: SELL") || upper.includes("RECOMMENDATION: SELL")) {
    direction = "sell";
  }

  // Extract confidence
  const confMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
  const confidence = confMatch ? Math.min(1, Math.max(0, parseFloat(confMatch[1]))) : 0.5;

  // Extract reasoning
  const reasonMatch = response.match(/REASONING:\s*(.+?)(?:\n|$)/i);
  const reasoning = reasonMatch ? reasonMatch[1].trim() : response.slice(0, 200);

  return { direction, confidence, reasoning };
}

// ── AI Orchestrator ───────────────────────────────────────────────────────

export class AIOrchestrator extends EventEmitter {
  private agents: AgentConfig[];
  private memory: OrchMemoryEntry[] = [];
  private runningFlows = new Set<string>();

  constructor(agents: AgentConfig[] = DEFAULT_AGENTS) {
    super();
    this.agents = agents;
  }

  // ── Agent Management ──────────────────────────────────────────────────────

  getAgents(): AgentConfig[] {
    return [...this.agents];
  }

  updateAgent(id: string, updates: Partial<AgentConfig>): AgentConfig | null {
    const idx = this.agents.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.agents[idx] = { ...this.agents[idx], ...updates };
    return this.agents[idx];
  }

  // ── Main Orchestration Flow ───────────────────────────────────────────────

  async run(params: {
    symbol: string;
    candles: OHLCV[];
    currentPrice: number;
    balance: number;
    openPositions: number;
    tradeMode: "manual" | "semi_auto" | "full_auto";
    signalThreshold: number;
    autoApproveBelow: number;
  }): Promise<OrchestratorResult> {
    const flowId = `${params.symbol}-${Date.now()}`;
    this.runningFlows.add(flowId);
    const startTime = Date.now();

    try {
      // Step 1: Technical analysis
      const techSignal = scoreSignal(params.candles, {
        rsiPeriod: 14,
        emaFast: 9,
        emaSlow: 21,
        bbPeriod: 20,
        atrPeriod: 14,
        volumePeriod: 20,
      });

      // Build context for agents
      const indicatorSummary = this.buildIndicatorSummary(techSignal.indicators, params.currentPrice);
      const memoryContext = this.buildMemoryContext(params.symbol);

      // Step 2: Run enabled agents in parallel
      const enabledAgents = this.agents.filter((a) => a.enabled);
      const agentPromises = enabledAgents.map((agent) =>
        this.runAgent(agent, params.symbol, params.currentPrice, indicatorSummary, memoryContext)
      );

      const agentDecisions = await Promise.all(agentPromises);

      // Step 3: Weighted voting
      const { finalDecision, weightedScore, confidence } = this.weightedVote(agentDecisions, enabledAgents);

      // Step 4: Risk check
      const atr = techSignal.indicators["atr"] ?? params.currentPrice * 0.01;
      const riskCheck = riskEngine.checkOrder({
        symbol: params.symbol,
        side: finalDecision === "buy" ? "buy" : "sell",
        qty: 0, // will be calculated
        price: params.currentPrice,
        exchangeId: "binance",
        atr,
      });

      // Step 5: Position sizing
      const riskPct = riskEngine.getConfig().riskPerTradePct;
      const riskUsd = params.balance * (riskPct / 100);
      const slDistance = riskCheck.adjustedSL
        ? Math.abs(params.currentPrice - riskCheck.adjustedSL)
        : params.currentPrice * 0.02;
      const suggestedQty = slDistance > 0 ? riskUsd / slDistance : 0;

      // Step 6: Determine if approval needed
      const requiresApproval = params.tradeMode === "semi_auto" ||
        (params.tradeMode === "full_auto" && confidence < params.autoApproveBelow);

      // Build reasoning summary
      const reasoning = this.buildReasoning(agentDecisions, finalDecision, confidence, weightedScore);

      const result: OrchestratorResult = {
        id: flowId,
        symbol: params.symbol,
        finalDecision,
        confidence,
        weightedScore,
        agentDecisions,
        reasoning,
        riskApproved: riskCheck.approved && finalDecision !== "hold",
        riskReasons: riskCheck.reasons,
        suggestedEntry: params.currentPrice,
        suggestedSL: riskCheck.adjustedSL ?? params.currentPrice * (finalDecision === "buy" ? 0.98 : 1.02),
        suggestedTP: riskCheck.adjustedTP ?? params.currentPrice * (finalDecision === "buy" ? 1.04 : 0.96),
        suggestedQty: riskCheck.adjustedQty ?? suggestedQty,
        requiresApproval,
        latencyMs: Date.now() - startTime,
        ts: Date.now(),
      };

      // Store in memory
      this.memory.unshift({ symbol: params.symbol, decision: result, ts: Date.now() });
      if (this.memory.length > 100) this.memory.pop();

      this.emit("decision", result);
      logger.info({
        symbol: params.symbol,
        decision: finalDecision,
        confidence: confidence.toFixed(2),
        latencyMs: result.latencyMs,
      }, "AI orchestration complete");

      return result;

    } finally {
      this.runningFlows.delete(flowId);
    }
  }

  private async runAgent(
    agent: AgentConfig,
    symbol: string,
    price: number,
    indicatorSummary: string,
    memoryContext: string
  ): Promise<AgentDecision> {
    const start = Date.now();

    const userPrompt = this.buildAgentPrompt(agent.role, symbol, price, indicatorSummary, memoryContext);

    try {
      const response = await callLLM(agent.provider, agent.model, agent.systemPrompt ?? "", userPrompt);
      const parsed = parseAgentResponse(response);

      return {
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        direction: parsed.direction,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        latencyMs: Date.now() - start,
        ts: Date.now(),
      };
    } catch (err) {
      logger.warn({ err, agentId: agent.id }, "Agent failed");
      return {
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        direction: "hold",
        confidence: 0,
        reasoning: `Agent error: ${String(err)}`,
        latencyMs: Date.now() - start,
        ts: Date.now(),
      };
    }
  }

  private buildAgentPrompt(
    role: AgentRole,
    symbol: string,
    price: number,
    indicators: string,
    memory: string
  ): string {
    const rolePrompts: Record<AgentRole, string> = {
      market: `Analyze the current market microstructure for ${symbol} at $${price}.\n${indicators}\n${memory}\nProvide: DECISION: [BUY/SELL/HOLD] | CONFIDENCE: [0-1] | REASONING: [brief explanation]`,
      trend: `Analyze the trend for ${symbol} at $${price}.\n${indicators}\n${memory}\nFocus on EMA alignment, momentum, and trend strength.\nProvide: DECISION: [BUY/SELL/HOLD] | CONFIDENCE: [0-1] | REASONING: [brief explanation]`,
      volatility: `Analyze volatility conditions for ${symbol} at $${price}.\n${indicators}\n${memory}\nFocus on ATR, Bollinger Bands, and volatility regime.\nProvide: DECISION: [BUY/SELL/HOLD] | CONFIDENCE: [0-1] | REASONING: [brief explanation]`,
      risk: `Evaluate risk for a trade on ${symbol} at $${price}.\n${indicators}\n${memory}\nConsider position sizing, drawdown risk, and portfolio exposure.\nProvide: DECISION: [BUY/SELL/HOLD] | CONFIDENCE: [0-1] | REASONING: [brief explanation]`,
      sentiment: `Analyze market sentiment for ${symbol} at $${price}.\n${indicators}\n${memory}\nConsider funding rates, long/short ratios, and fear/greed.\nProvide: DECISION: [BUY/SELL/HOLD] | CONFIDENCE: [0-1] | REASONING: [brief explanation]`,
      execution: `Determine optimal execution for ${symbol} at $${price}.\n${indicators}\n${memory}\nFocus on entry timing, order type, and slippage.\nProvide: DECISION: [BUY/SELL/HOLD] | CONFIDENCE: [0-1] | REASONING: [brief explanation]`,
      portfolio: `Evaluate portfolio impact of trading ${symbol} at $${price}.\n${indicators}\n${memory}\nConsider correlation, diversification, and overall portfolio health.\nProvide: DECISION: [BUY/SELL/HOLD] | CONFIDENCE: [0-1] | REASONING: [brief explanation]`,
    };

    return rolePrompts[role];
  }

  private buildIndicatorSummary(indicators: Record<string, number>, price: number): string {
    const lines: string[] = [`Current Price: $${price.toFixed(2)}`];

    if (!isNaN(indicators["rsi"])) lines.push(`RSI(14): ${indicators["rsi"].toFixed(1)}`);
    if (!isNaN(indicators["emaFast"])) lines.push(`EMA(9): ${indicators["emaFast"].toFixed(2)}`);
    if (!isNaN(indicators["emaSlow"])) lines.push(`EMA(21): ${indicators["emaSlow"].toFixed(2)}`);
    if (!isNaN(indicators["macd"])) lines.push(`MACD: ${indicators["macd"].toFixed(4)}`);
    if (!isNaN(indicators["macdHistogram"])) lines.push(`MACD Histogram: ${indicators["macdHistogram"].toFixed(4)}`);
    if (!isNaN(indicators["bbUpper"])) lines.push(`BB Upper: ${indicators["bbUpper"].toFixed(2)}`);
    if (!isNaN(indicators["bbLower"])) lines.push(`BB Lower: ${indicators["bbLower"].toFixed(2)}`);
    if (!isNaN(indicators["percentB"])) lines.push(`%B: ${(indicators["percentB"] * 100).toFixed(1)}%`);
    if (!isNaN(indicators["atr"])) lines.push(`ATR(14): ${indicators["atr"].toFixed(4)}`);
    if (!isNaN(indicators["volumeRatio"])) lines.push(`Volume Ratio: ${indicators["volumeRatio"].toFixed(2)}x avg`);

    return lines.join("\n");
  }

  private buildMemoryContext(symbol: string): string {
    const recent = this.memory
      .filter((m) => m.symbol === symbol)
      .slice(0, 3);

    if (recent.length === 0) return "";

    const lines = recent.map((m) => {
      const outcome = m.outcome ? ` → ${m.outcome.toUpperCase()}${m.pnl ? ` ($${m.pnl.toFixed(2)})` : ""}` : " → pending";
      return `${new Date(m.ts).toISOString()}: ${m.decision.finalDecision.toUpperCase()} @ ${m.decision.suggestedEntry.toFixed(2)}${outcome}`;
    });

    return `\nRecent decisions for ${symbol}:\n${lines.join("\n")}`;
  }

  private weightedVote(
    decisions: AgentDecision[],
    agents: AgentConfig[]
  ): { finalDecision: "buy" | "sell" | "hold"; weightedScore: number; confidence: number } {
    let buyWeight = 0;
    let sellWeight = 0;
    let holdWeight = 0;
    let totalWeight = 0;

    for (const decision of decisions) {
      const agent = agents.find((a) => a.id === decision.agentId);
      if (!agent) continue;

      const weight = agent.weight * decision.confidence;
      totalWeight += agent.weight;

      if (decision.direction === "buy") buyWeight += weight;
      else if (decision.direction === "sell") sellWeight += weight;
      else holdWeight += weight;
    }

    const normalizer = totalWeight > 0 ? totalWeight : 1;
    const buyScore = buyWeight / normalizer;
    const sellScore = sellWeight / normalizer;

    let finalDecision: "buy" | "sell" | "hold" = "hold";
    let weightedScore = 0;

    if (buyScore > sellScore && buyScore > 0.3) {
      finalDecision = "buy";
      weightedScore = buyScore;
    } else if (sellScore > buyScore && sellScore > 0.3) {
      finalDecision = "sell";
      weightedScore = sellScore;
    }

    // Confidence = agreement ratio
    const dominantCount = decisions.filter((d) => d.direction === finalDecision).length;
    const confidence = decisions.length > 0 ? dominantCount / decisions.length : 0;

    return { finalDecision, weightedScore, confidence };
  }

  private buildReasoning(
    decisions: AgentDecision[],
    finalDecision: string,
    confidence: number,
    weightedScore: number
  ): string {
    const agreeing = decisions.filter((d) => d.direction === finalDecision);
    const disagreeing = decisions.filter((d) => d.direction !== finalDecision && d.direction !== "hold");

    const parts: string[] = [
      `Final: ${finalDecision.toUpperCase()} (confidence: ${(confidence * 100).toFixed(0)}%, weighted score: ${(weightedScore * 100).toFixed(0)}%)`,
      `${agreeing.length}/${decisions.length} agents agree.`,
    ];

    if (agreeing.length > 0) {
      parts.push(`Supporting: ${agreeing.map((d) => `${d.agentName} (${(d.confidence * 100).toFixed(0)}%)`).join(", ")}`);
    }
    if (disagreeing.length > 0) {
      parts.push(`Opposing: ${disagreeing.map((d) => `${d.agentName}`).join(", ")}`);
    }

    const topReason = agreeing[0]?.reasoning;
    if (topReason) parts.push(`Key reasoning: ${topReason.slice(0, 200)}`);

    return parts.join(" | ");
  }

  // ── Memory Management ─────────────────────────────────────────────────────

  recordOutcome(flowId: string, outcome: "win" | "loss", pnl: number) {
    const entry = this.memory.find((m) => m.decision.id === flowId);
    if (entry) {
      entry.outcome = outcome;
      entry.pnl = pnl;
    }
  }

  getMemory(symbol?: string): OrchMemoryEntry[] {
    if (symbol) return this.memory.filter((m) => m.symbol === symbol);
    return [...this.memory];
  }

  clearMemory() {
    this.memory = [];
  }
}

// Singleton
export const aiOrchestrator = new AIOrchestrator();
