/// Nexus Barter-rs Service
/// Görev: Piyasa verisi akışı → Sinyal üretimi → Risk kontrolü → REST API
/// Port: 8090
///
/// Gerçek Barter-rs entegrasyonu için:
/// https://github.com/barter-rs/barter-rs
use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;
use chrono::Utc;

// ── State ──────────────────────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    signals: Arc<RwLock<Vec<Signal>>>,
    risk_config: Arc<RwLock<RiskConfig>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Signal {
    id:           String,
    exchange:     String,
    sym:          String,
    side:         String,   // buy | sell
    strength:     f64,      // 0..1
    reason:       String,
    strategy:     String,
    market_type:  String,
    generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RiskConfig {
    max_position_pct:    f64,
    stop_loss_pct:       f64,
    take_profit_pct:     f64,
    max_daily_loss_pct:  f64,
    max_open_positions:  u32,
    risk_per_trade_pct:  f64,
}

impl Default for RiskConfig {
    fn default() -> Self {
        Self {
            max_position_pct:   5.0,
            stop_loss_pct:      2.0,
            take_profit_pct:    4.0,
            max_daily_loss_pct: 8.0,
            max_open_positions: 5,
            risk_per_trade_pct: 1.0,
        }
    }
}

#[derive(Deserialize)]
struct RiskCheckRequest {
    sym:        String,
    side:       String,
    qty:        f64,
    price:      f64,
    equity:     f64,
    confidence: f64,
}

#[derive(Serialize)]
struct RiskCheckResponse {
    ok:             bool,
    reason:         Option<String>,
    position_size:  f64,
    sl_price:       f64,
    tp_price:       f64,
}

// ── Handlers ──────────────────────────────────────────────────────────────

async fn healthz() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "nexus-barter", "ts": Utc::now().to_rfc3339() }))
}

async fn get_signals(State(state): State<AppState>) -> Json<Vec<Signal>> {
    let signals = state.signals.read().await;
    Json(signals.clone())
}

async fn risk_check(
    State(state): State<AppState>,
    Json(req): Json<RiskCheckRequest>,
) -> Json<RiskCheckResponse> {
    let cfg = state.risk_config.read().await;

    // Pozisyon büyüklüğü kontrolü
    let pos_value    = req.qty * req.price;
    let max_pos      = req.equity * cfg.max_position_pct / 100.0;
    let risk_amount  = req.equity * cfg.risk_per_trade_pct / 100.0;

    // Güven eşiği
    if req.confidence < 0.60 {
        return Json(RiskCheckResponse {
            ok: false,
            reason: Some(format!("Güven çok düşük: {:.1}% < 60%", req.confidence * 100.0)),
            position_size: 0.0, sl_price: 0.0, tp_price: 0.0,
        });
    }

    if pos_value > max_pos {
        return Json(RiskCheckResponse {
            ok: false,
            reason: Some(format!("Pozisyon çok büyük: ${:.2} > max ${:.2}", pos_value, max_pos)),
            position_size: 0.0, sl_price: 0.0, tp_price: 0.0,
        });
    }

    // SL/TP hesapla
    let (sl_price, tp_price) = if req.side == "buy" {
        (
            req.price * (1.0 - cfg.stop_loss_pct / 100.0),
            req.price * (1.0 + cfg.take_profit_pct / 100.0),
        )
    } else {
        (
            req.price * (1.0 + cfg.stop_loss_pct / 100.0),
            req.price * (1.0 - cfg.take_profit_pct / 100.0),
        )
    };

    // Kelly pozisyon boyutu
    let kelly_size = (risk_amount / (req.price * cfg.stop_loss_pct / 100.0)).min(req.qty);

    Json(RiskCheckResponse {
        ok: true,
        reason: None,
        position_size: kelly_size,
        sl_price,
        tp_price,
    })
}

async fn update_risk(
    State(state): State<AppState>,
    Json(cfg): Json<RiskConfig>,
) -> Json<RiskConfig> {
    let mut lock = state.risk_config.write().await;
    *lock = cfg.clone();
    Json(cfg)
}

async fn get_risk(State(state): State<AppState>) -> Json<RiskConfig> {
    Json(state.risk_config.read().await.clone())
}

// ── Sinyal üretici (simüle — gerçek Barter DataStream geldiğinde buraya) ──

async fn spawn_signal_generator(state: AppState) {
    let pairs = vec![
        ("okx", "BTCUSDT", "spot"),   ("okx", "ETHUSDT", "spot"),
        ("binance", "SOLUSDT", "spot"),("binance", "BNBUSDT", "spot"),
        ("okx", "BTCUSDT-PERP", "perp"),
    ];
    let reasons_buy = vec![
        "RSI aşırı satım bölgesinden çıkış",
        "MACD pozitif crossover",
        "Fibonacci %61.8 destek tuttu",
        "Funding rate negatif — long cazip",
    ];
    let reasons_sell = vec![
        "RSI aşırı alım (%78+)",
        "Direnç bölgesine yaklaşım",
        "MACD negatif crossover",
        "Funding rate pozitif — short avantajlı",
    ];

    loop {
        tokio::time::sleep(tokio::time::Duration::from_millis(2800)).await;

        let idx    = (Utc::now().timestamp_millis() as usize) % pairs.len();
        let (ex, sym, mkt) = pairs[idx];
        let strength: f64  = 0.52 + (Utc::now().timestamp_nanos_opt().unwrap_or(0) % 46) as f64 / 100.0;
        let side    = if strength > 0.73 { "buy" } else { "sell" };
        let reasons = if side == "buy" { &reasons_buy } else { &reasons_sell };
        let reason  = reasons[(Utc::now().timestamp_millis() as usize) % reasons.len()];

        let signal = Signal {
            id:           Uuid::new_v4().to_string(),
            exchange:     ex.to_string(),
            sym:          sym.to_string(),
            side:         side.to_string(),
            strength,
            reason:       reason.to_string(),
            strategy:     "barter-rs-v1".to_string(),
            market_type:  mkt.to_string(),
            generated_at: Utc::now().to_rfc3339(),
        };

        let mut signals = state.signals.write().await;
        signals.insert(0, signal);
        if signals.len() > 500 { signals.truncate(500); }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();

    let state = AppState {
        signals:     Arc::new(RwLock::new(Vec::new())),
        risk_config: Arc::new(RwLock::new(RiskConfig::default())),
    };

    // Sinyal üreticisini başlat
    let state_clone = state.clone();
    tokio::spawn(async move { spawn_signal_generator(state_clone).await });

    let app = Router::new()
        .route("/healthz",      get(healthz))
        .route("/signals",      get(get_signals))
        .route("/risk/check",   post(risk_check))
        .route("/risk/config",  get(get_risk).put(update_risk))
        .with_state(state);

    let port: u16 = std::env::var("BARTER_PORT")
        .unwrap_or_else(|_| "8090".to_string())
        .parse()
        .unwrap_or(8090);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    info!("Nexus Barter-rs Risk Engine başlatılıyor: {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
