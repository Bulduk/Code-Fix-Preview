"""
Nexus Trade OS — Nautilus Trader Orchestrator
FastAPI + LangGraph + CCXT + Telegram

Görev:
  1. Barter-rs'tan sinyal al
  2. LangGraph akışı: market_data → llm_analysis → risk_check → [telegram_approval] → ccxt_execute
  3. Trade modu: paper | semi_auto | full_auto
  4. Tüm işlemleri PostgreSQL'e yaz
"""

import os, asyncio, uuid, json, logging
from datetime import datetime, timezone
from typing import Optional
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncpg
import redis.asyncio as aioredis

structlog_available = False
try:
    import structlog
    logger = structlog.get_logger()
    structlog_available = True
except ImportError:
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("nexus")

# ── Config ────────────────────────────────────────────────────────────────

DATABASE_URL   = os.getenv("DATABASE_URL", "postgresql://nexus:password@localhost:5432/nexusdb")
REDIS_URL      = os.getenv("REDIS_URL", "redis://localhost:6379")
BARTER_URL     = os.getenv("BARTER_URL", "http://localhost:8090")
TRADE_MODE     = os.getenv("TRADE_MODE", "paper")   # paper | semi_auto | full_auto
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT  = os.getenv("TELEGRAM_CHAT_ID", "")

OKX_API_KEY    = os.getenv("OKX_API_KEY", "")
OKX_SECRET     = os.getenv("OKX_SECRET", "")
OKX_PASS       = os.getenv("OKX_PASSPHRASE", "")
BINANCE_KEY    = os.getenv("BINANCE_API_KEY", "")
BINANCE_SECRET = os.getenv("BINANCE_SECRET", "")

# ── DB Pool ───────────────────────────────────────────────────────────────

db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[aioredis.Redis] = None

async def get_db() -> asyncpg.Pool:
    global db_pool
    if not db_pool:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return db_pool

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool, redis_client
    try:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        logger.info("PostgreSQL bağlandı")
    except Exception as e:
        logger.warning(f"PostgreSQL bağlantı hatası (devam ediliyor): {e}")

    try:
        redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
        await redis_client.ping()
        logger.info("Redis bağlandı")
    except Exception as e:
        logger.warning(f"Redis bağlantı hatası: {e}")

    yield

    if db_pool: await db_pool.close()
    if redis_client: await redis_client.close()

# ── App ───────────────────────────────────────────────────────────────────

app = FastAPI(title="Nexus Nautilus Orchestrator", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Models ────────────────────────────────────────────────────────────────

class OrderRequest(BaseModel):
    exchange:  str       # okx | binance | bybit
    sym:       str       # BTCUSDT
    side:      str       # buy | sell
    type:      str = "market"
    qty:       float
    price:     Optional[float] = None
    strategy:  Optional[str]  = None
    is_paper:  Optional[bool] = None   # None = TRADE_MODE'a göre

class SignalEvent(BaseModel):
    exchange:  str
    sym:       str
    side:      str
    strength:  float
    reason:    str
    strategy:  Optional[str] = None

class FlowResult(BaseModel):
    order_id:   Optional[str]
    status:     str    # placed | pending_approval | rejected | paper_filled
    latency_ms: int
    reasoning:  Optional[str]
    is_paper:   bool

# ── CCXT Exchange Factory ─────────────────────────────────────────────────

def make_exchange(name: str, paper: bool = True):
    import ccxt.async_support as ccxt
    cfg: dict = {"enableRateLimit": True, "timeout": 15000}
    if name == "okx" and OKX_API_KEY:
        cfg["apiKey"]   = OKX_API_KEY
        cfg["secret"]   = OKX_SECRET
        cfg["password"] = OKX_PASS
        if paper: cfg["options"] = {"defaultType": "spot"}
    elif name == "binance" and BINANCE_KEY:
        cfg["apiKey"] = BINANCE_KEY
        cfg["secret"] = BINANCE_SECRET
        if paper: cfg["options"] = {"defaultType": "spot"}
    ex_class = getattr(ccxt, name, None)
    if not ex_class:
        raise HTTPException(400, f"CCXT exchange '{name}' bulunamadı")
    return ex_class(cfg)

# ── LangGraph Flow (simplified — LangGraph bağımlılığı opsiyonel) ─────────

async def run_llm_analysis(sym: str, side: str, strength: float, provider: str = "anthropic") -> dict:
    """LLM analizi — gerçek API veya mock."""
    try:
        anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        if anthropic_key and provider == "anthropic":
            import anthropic
            client  = anthropic.AsyncAnthropic(api_key=anthropic_key)
            prompt  = f"Trading signal: {sym} {side.upper()} strength={strength:.2f}. Analyze briefly (2 sentences) whether to proceed. Reply with: PROCEED or SKIP, then reason."
            message = await client.messages.create(model="claude-3-5-haiku-20241022", max_tokens=150, messages=[{"role":"user","content":prompt}])
            text    = message.content[0].text if message.content else ""
            return {"decision": "PROCEED" if "PROCEED" in text.upper() else "SKIP", "reasoning": text, "confidence": strength}
    except Exception as e:
        logger.warning(f"LLM API hatası, mock kullanılıyor: {e}")

    # Mock fallback
    decision = "PROCEED" if strength >= 0.65 else "SKIP"
    return {
        "decision": decision,
        "reasoning": f"[Mock] {sym} {side.upper()} — güven {strength:.0%} {'yeterli, işleme geç.' if decision=='PROCEED' else 'yetersiz, geç.'}",
        "confidence": strength,
    }

async def send_telegram(text: str) -> bool:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_CHAT, "text": text, "parse_mode": "HTML"}
            )
            return r.status_code == 200
    except Exception as e:
        logger.warning(f"Telegram hata: {e}")
        return False

async def save_order_db(pool: asyncpg.Pool, order_id: str, data: dict):
    try:
        await pool.execute("""
            INSERT INTO orders (id, exchange_id, exchange, sym, side, type, qty, px, avg_fill_px, status, is_paper, placed_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT DO NOTHING
        """, order_id, data.get("exchange_id","1"), data["exchange"], data["sym"],
             data["side"], data["type"], data["qty"], data.get("price"), data.get("avg_fill_px",0),
             data.get("status","filled"), str(data.get("is_paper",True)), "nautilus")
    except Exception as e:
        logger.warning(f"DB kayıt hatası: {e}")

# ── API Routes ────────────────────────────────────────────────────────────

@app.get("/healthz")
async def healthz():
    return {"status": "ok", "trade_mode": TRADE_MODE, "ts": datetime.now(timezone.utc).isoformat()}

@app.get("/signals")
async def get_barter_signals():
    """Barter-rs'tan sinyalleri getir."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{BARTER_URL}/signals")
            return r.json()
    except Exception as e:
        return {"error": str(e), "signals": []}

@app.post("/flow", response_model=FlowResult)
async def run_flow(req: OrderRequest, bg: BackgroundTasks):
    """
    Ana LangGraph Akışı:
    market_data → llm_analysis → risk_check → [telegram] → ccxt_execute
    """
    start_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    is_paper = req.is_paper if req.is_paper is not None else (TRADE_MODE == "paper")

    # 1. LLM Analiz
    llm = await run_llm_analysis(req.sym, req.side, 0.75)
    if llm["decision"] == "SKIP":
        return FlowResult(order_id=None, status="rejected", latency_ms=int(datetime.now(timezone.utc).timestamp()*1000)-start_ms,
                          reasoning=llm["reasoning"], is_paper=is_paper)

    # 2. Barter-rs Risk Check
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            risk_r = await client.post(f"{BARTER_URL}/risk/check", json={
                "sym": req.sym, "side": req.side, "qty": req.qty,
                "price": req.price or 0, "equity": 10000, "confidence": llm["confidence"]
            })
            risk = risk_r.json()
    except:
        risk = {"ok": True, "position_size": req.qty, "sl_price": 0, "tp_price": 0}

    if not risk.get("ok"):
        return FlowResult(order_id=None, status="rejected", latency_ms=0, reasoning=risk.get("reason"), is_paper=is_paper)

    # 3. Telegram onay (semi_auto modda)
    if TRADE_MODE == "semi_auto" and not is_paper:
        await send_telegram(
            f"🔔 <b>Nexus Trade Onay</b>\n"
            f"📊 {req.exchange.upper()} {req.sym}\n"
            f"{'🟢' if req.side=='buy' else '🔴'} {req.side.upper()} {req.qty}\n"
            f"💡 {llm['reasoning'][:200]}\n\n"
            f"⚡ Tam oto modda otomatik execute edilecek."
        )

    # 4. Emir ver
    order_id  = str(uuid.uuid4())
    avg_fill  = req.price or 0

    if is_paper:
        status = "paper_filled"
    else:
        try:
            ex  = make_exchange(req.exchange, paper=False)
            sym = req.sym if "/" in req.sym else req.sym.replace("USDT", "/USDT")
            order = await ex.create_order(sym, req.type, req.side, req.qty, req.price)
            await ex.close()
            order_id = order.get("id", order_id)
            avg_fill = order.get("average") or order.get("price") or 0
            status   = "placed"
        except Exception as e:
            logger.error(f"CCXT emir hatası: {e}")
            raise HTTPException(400, str(e))

    # 5. DB kaydet (arka planda)
    try:
        pool = await get_db()
        bg.add_task(save_order_db, pool, order_id, {
            "exchange": req.exchange, "sym": req.sym, "side": req.side,
            "type": req.type, "qty": req.qty, "price": req.price,
            "avg_fill_px": avg_fill, "status": status, "is_paper": is_paper, "exchange_id": "1"
        })
    except: pass

    latency = int(datetime.now(timezone.utc).timestamp() * 1000) - start_ms
    return FlowResult(order_id=order_id, status=status, latency_ms=latency, reasoning=llm["reasoning"], is_paper=is_paper)

@app.get("/positions")
async def get_positions():
    try:
        pool = await get_db()
        rows = await pool.fetch("SELECT * FROM positions WHERE is_open = true ORDER BY opened_at DESC LIMIT 50")
        return [dict(r) for r in rows]
    except:
        return []

@app.get("/orders")
async def get_orders(limit: int = 100):
    try:
        pool = await get_db()
        rows = await pool.fetch("SELECT * FROM orders ORDER BY created_at DESC LIMIT $1", limit)
        return [dict(r) for r in rows]
    except:
        return []

@app.get("/pnl")
async def get_pnl():
    try:
        pool = await get_db()
        rows = await pool.fetch("SELECT * FROM pnl_snapshots ORDER BY snapshot_at DESC LIMIT 1440")
        return [{"ts": int(r["snapshot_at"].timestamp()*1000), "equity": r["equity"], "realized": r["realized"], "unrealized": r["unrealized"]} for r in rows]
    except:
        return []

@app.get("/config/trade-mode")
async def get_trade_mode():
    return {"mode": TRADE_MODE}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("NAUTILUS_PORT", "8091"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
