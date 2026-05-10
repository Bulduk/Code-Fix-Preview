"""
Nexus Trade OS — Python Orchestrator
LangGraph stateful karar döngüsü + Claude/Gemini + Rust Risk köprüsü
"""

from __future__ import annotations

import asyncio
import os
import time
import uuid
from typing import TypedDict, Annotated, Literal, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# LangGraph imports
try:
    from langgraph.graph import StateGraph, END
    from langgraph.graph.message import add_messages
    LANGGRAPH_OK = True
except ImportError:
    LANGGRAPH_OK = False
    print("[WARN] langgraph not installed — using stub flow")

# Anthropic (Claude)
try:
    import anthropic
    CLAUDE_OK = True
except ImportError:
    CLAUDE_OK = False
    print("[WARN] anthropic not installed — Claude stubs active")

# Google Generative AI (Gemini)
try:
    import google.generativeai as genai
    GEMINI_OK = True
except ImportError:
    GEMINI_OK = False
    print("[WARN] google-generativeai not installed — Gemini stubs active")


# ─── FastAPI App ────────────────────────────────────────────────────────────

app = FastAPI(title="Nexus Orchestrator", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic Models ────────────────────────────────────────────────────────

class InvokeRequest(BaseModel):
    sym: str = "BTCUSDT"
    provider: Literal["anthropic", "google"] = "anthropic"
    telegram_enabled: bool = False
    telegram_chat_id: str = ""

class NodeResult(BaseModel):
    id: str
    label: str
    status: Literal["idle", "running", "done", "error"]
    latency_ms: int

class Decision(BaseModel):
    sym: str
    side: Literal["buy", "sell"]
    confidence: float
    reasoning: str
    risk_ok: bool

class InvokeResponse(BaseModel):
    run_id: str
    decision: Decision
    nodes: list[NodeResult]
    total_ms: int


# ─── LangGraph State ────────────────────────────────────────────────────────

class TradeState(TypedDict):
    sym: str
    provider: str
    tick: dict[str, Any]
    analysis: str
    decision: dict[str, Any]
    risk_ok: bool
    executed: bool
    node_times: dict[str, int]


# ─── Node Functions ─────────────────────────────────────────────────────────

async def node_market_data(state: TradeState) -> TradeState:
    t0 = time.monotonic()
    # In production: CCXT Pro WebSocket tick
    tick = {
        "sym": state["sym"],
        "px": 67_234.0 + (hash(state["sym"]) % 1000),
        "volume_24h": 28_400_000_000,
        "change_24h": 2.34,
        "rsi_14": 62.7,
        "macd_signal": "bullish_cross",
    }
    state["tick"] = tick
    state["node_times"]["market_data"] = int((time.monotonic() - t0) * 1000)
    return state


async def node_llm_analysis(state: TradeState) -> TradeState:
    t0 = time.monotonic()
    sym = state["sym"]
    tick = state["tick"]
    provider = state["provider"]

    prompt = f"""Sen bir kripto para traderısın. Aşağıdaki piyasa verisini analiz et ve işlem kararı ver.

Sembol: {sym}
Fiyat: ${tick['px']:,.2f}
RSI(14): {tick['rsi_14']}
MACD: {tick['macd_signal']}
24h Değişim: {tick['change_24h']}%

JSON formatında yanıt ver:
{{"side": "buy|sell", "confidence": 0.0-1.0, "reasoning": "kısa açıklama"}}"""

    analysis = ""
    if provider == "anthropic" and CLAUDE_OK:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if api_key:
            client = anthropic.Anthropic(api_key=api_key)
            msg = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            analysis = msg.content[0].text
        else:
            analysis = f'{{"side": "buy", "confidence": 0.78, "reasoning": "Claude stub: RSI {tick[\"rsi_14\"]} — momentum pozitif"}}'
    elif provider == "google" and GEMINI_OK:
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-pro")
            resp = model.generate_content(prompt)
            analysis = resp.text
        else:
            analysis = f'{{"side": "buy", "confidence": 0.72, "reasoning": "Gemini stub: MACD bullish crossover — güçlü momentum"}}'
    else:
        analysis = f'{{"side": "buy", "confidence": 0.71, "reasoning": "Stub: {sym} teknik göstergeler pozitif"}}'

    state["analysis"] = analysis
    state["node_times"]["llm_analysis"] = int((time.monotonic() - t0) * 1000)
    return state


async def node_rust_risk(state: TradeState) -> TradeState:
    """
    Production'da: PyO3 ile Rust risk engine çağrısı.
    cargo build --release && Python FFI üzerinden risk doğrulama.

    from nexus_risk import RiskEngine
    engine = RiskEngine(max_pos_pct=5.0, stop_loss_pct=2.0)
    result = engine.validate(position_size=0.01, equity=10000)
    """
    t0 = time.monotonic()

    import json
    try:
        parsed = json.loads(state["analysis"])
        confidence = float(parsed.get("confidence", 0.5))
        risk_ok = confidence >= 0.60
        state["decision"] = {
            "side": parsed.get("side", "buy"),
            "confidence": confidence,
            "reasoning": parsed.get("reasoning", ""),
        }
    except Exception:
        risk_ok = False
        state["decision"] = {"side": "buy", "confidence": 0.0, "reasoning": "parse error"}

    state["risk_ok"] = risk_ok
    await asyncio.sleep(0.008)  # Simüle Rust hızı (~8ms)
    state["node_times"]["rust_risk"] = int((time.monotonic() - t0) * 1000)
    return state


async def node_telegram_approval(state: TradeState) -> TradeState:
    """
    Production'da: python-telegram-bot ile human-in-the-loop.
    Bot token: TELEGRAM_BOT_TOKEN env var
    """
    t0 = time.monotonic()
    # Stub — production: await bot.send_message(chat_id=..., text=...)
    await asyncio.sleep(0.001)
    state["node_times"]["telegram_approval"] = int((time.monotonic() - t0) * 1000)
    return state


async def node_ccxt_execute(state: TradeState) -> TradeState:
    """
    Production'da: ccxt.pro ile gerçek emir.
    exchange = ccxt.pro.binance({"apiKey": ..., "secret": ...})
    await exchange.create_order(symbol, "market", "buy", amount)
    """
    t0 = time.monotonic()
    await asyncio.sleep(0.095)  # Simüle CCXT Pro latency (~95ms)
    state["executed"] = state["risk_ok"]
    state["node_times"]["ccxt_execute"] = int((time.monotonic() - t0) * 1000)
    return state


def should_execute(state: TradeState) -> Literal["execute", "skip"]:
    return "execute" if state.get("risk_ok", False) else "skip"


# ─── Build LangGraph ────────────────────────────────────────────────────────

def build_graph():
    if not LANGGRAPH_OK:
        return None

    builder = StateGraph(TradeState)
    builder.add_node("market_data", node_market_data)
    builder.add_node("llm_analysis", node_llm_analysis)
    builder.add_node("rust_risk", node_rust_risk)
    builder.add_node("telegram_approval", node_telegram_approval)
    builder.add_node("ccxt_execute", node_ccxt_execute)

    builder.set_entry_point("market_data")
    builder.add_edge("market_data", "llm_analysis")
    builder.add_edge("llm_analysis", "rust_risk")
    builder.add_conditional_edges("rust_risk", should_execute, {
        "execute": "telegram_approval",
        "skip": END,
    })
    builder.add_edge("telegram_approval", "ccxt_execute")
    builder.add_edge("ccxt_execute", END)

    return builder.compile()


GRAPH = build_graph()


# ─── API Routes ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "langgraph": LANGGRAPH_OK,
        "claude": CLAUDE_OK,
        "gemini": GEMINI_OK,
    }


@app.post("/invoke", response_model=InvokeResponse)
async def invoke(req: InvokeRequest):
    run_id = str(uuid.uuid4())[:8]
    total_start = time.monotonic()

    init_state: TradeState = {
        "sym": req.sym,
        "provider": req.provider,
        "tick": {},
        "analysis": "",
        "decision": {},
        "risk_ok": False,
        "executed": False,
        "node_times": {},
    }

    if GRAPH is not None:
        final_state = await GRAPH.ainvoke(init_state)
    else:
        # Stub flow when LangGraph not installed
        state = init_state
        for fn in [node_market_data, node_llm_analysis, node_rust_risk,
                   node_telegram_approval, node_ccxt_execute]:
            state = await fn(state)
        final_state = state

    total_ms = int((time.monotonic() - total_start) * 1000)
    d = final_state.get("decision", {})
    node_times = final_state.get("node_times", {})

    node_labels = {
        "market_data": "Market Data",
        "llm_analysis": "LLM Analysis",
        "rust_risk": "Risk Check (Rust)",
        "telegram_approval": "Telegram Onay",
        "ccxt_execute": "CCXT Execute",
    }

    nodes = [
        NodeResult(
            id=nid,
            label=node_labels.get(nid, nid),
            status="done" if nid in node_times else "idle",
            latency_ms=node_times.get(nid, 0),
        )
        for nid in node_labels
    ]

    return InvokeResponse(
        run_id=run_id,
        decision=Decision(
            sym=req.sym,
            side=d.get("side", "buy"),
            confidence=d.get("confidence", 0.0),
            reasoning=d.get("reasoning", ""),
            risk_ok=final_state.get("risk_ok", False),
        ),
        nodes=nodes,
        total_ms=total_ms,
    )


@app.get("/hello-trade")
async def hello_trade():
    """Hello Trade — LangGraph demo akışı"""
    req = InvokeRequest(sym="BTCUSDT", provider="anthropic")
    return await invoke(req)


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
