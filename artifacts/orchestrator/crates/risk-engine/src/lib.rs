//! Nexus Risk Engine — Rust hız katmanı
//! PyO3 ile Python'dan çağrılır, Polars ile veri işler
//!
//! Derleme:
//!   cargo build --release
//!   maturin develop --release (PyO3 için)

use pyo3::prelude::*;
use polars::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RiskParams {
    pub max_position_pct: f64,
    pub stop_loss_pct: f64,
    pub take_profit_pct: f64,
    pub max_daily_loss_pct: f64,
    pub max_open_positions: u32,
    pub risk_per_trade_pct: f64,
}

impl Default for RiskParams {
    fn default() -> Self {
        Self {
            max_position_pct: 5.0,
            stop_loss_pct: 2.0,
            take_profit_pct: 4.0,
            max_daily_loss_pct: 8.0,
            max_open_positions: 5,
            risk_per_trade_pct: 1.0,
        }
    }
}

/// Python'dan çağrılacak risk doğrulama fonksiyonu
///
/// ```python
/// from nexus_risk import validate_risk
/// ok = validate_risk(confidence=0.75, equity=10000.0, position_size=0.01,
///                    max_pos_pct=5.0, stop_loss_pct=2.0)
/// ```
#[pyfunction]
fn validate_risk(
    confidence: f64,
    equity: f64,
    position_size: f64,
    max_pos_pct: f64,
    stop_loss_pct: f64,
) -> PyResult<bool> {
    let position_value = position_size * 67_000.0; // mock price
    let position_pct = (position_value / equity) * 100.0;
    let risk_ok = confidence >= 0.60
        && position_pct <= max_pos_pct
        && stop_loss_pct >= 0.1
        && stop_loss_pct <= 15.0;
    Ok(risk_ok)
}

/// Polars DataFrame ile toplu risk hesabı
#[pyfunction]
fn batch_risk_check(
    confidences: Vec<f64>,
    position_sizes: Vec<f64>,
    equity: f64,
    max_pos_pct: f64,
) -> PyResult<Vec<bool>> {
    let conf_series = Series::new("confidence".into(), confidences.clone());
    let pos_series = Series::new("position_size".into(), position_sizes.clone());

    let df = DataFrame::new(vec![conf_series, pos_series])
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyValueError, _>(e.to_string()))?;

    let results: Vec<bool> = confidences.iter().zip(position_sizes.iter())
        .map(|(conf, pos)| {
            let pos_value = pos * 67_000.0;
            let pos_pct = (pos_value / equity) * 100.0;
            *conf >= 0.60 && pos_pct <= max_pos_pct
        })
        .collect();

    Ok(results)
}

/// Pozisyon boyutu hesabı (Kelly Criterion tabanlı)
#[pyfunction]
fn calc_position_size(
    equity: f64,
    confidence: f64,
    stop_loss_pct: f64,
    risk_per_trade_pct: f64,
) -> PyResult<f64> {
    let kelly_fraction = confidence - (1.0 - confidence);
    let capped_fraction = kelly_fraction.min(risk_per_trade_pct / 100.0);
    let risk_amount = equity * capped_fraction;
    let position_size = risk_amount / (stop_loss_pct / 100.0 * 67_000.0);
    Ok(position_size.max(0.001))
}

#[pymodule]
fn nexus_risk(_py: Python, m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(validate_risk, m)?)?;
    m.add_function(wrap_pyfunction!(batch_risk_check, m)?)?;
    m.add_function(wrap_pyfunction!(calc_position_size, m)?)?;
    Ok(())
}
