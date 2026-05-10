# Nexus Orchestrator — Python Servisi

LangGraph tabanlı stateful karar döngüsü.

## Mimari

```
[Market Data CCXT WS] → [LLM Analysis Claude/Gemini] → [Rust Risk Engine] → [Telegram Approval] → [CCXT Execute]
```

## Kurulum

```bash
pip install -e .
# veya
uv pip install -e .
```

## Çalıştırma

```bash
PORT=8001 python main.py
```

## API

- `GET /health` — Servis durumu
- `POST /invoke` — Akışı çalıştır
- `GET /hello-trade` — Demo akış

## Ortam Değişkenleri

```env
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
TELEGRAM_BOT_TOKEN=...
DATABASE_URL=postgresql://...
```

## Rust Hız Katmanı

`node_rust_risk` fonksiyonu production'da PyO3 üzerinden Rust engine'i çağırır:

```rust
// crates/risk-engine/src/lib.rs
use pyo3::prelude::*;

#[pyfunction]
fn validate_risk(confidence: f64, max_pos_pct: f64) -> PyResult<bool> {
    Ok(confidence >= 0.60 && max_pos_pct <= 5.0)
}

#[pymodule]
fn nexus_risk(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(validate_risk, m)?)?;
    Ok(())
}
```

Derleme:
```bash
cd crates/risk-engine
maturin develop --release
```
