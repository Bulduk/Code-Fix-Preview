import { Router, type IRouter } from "express";
import healthRouter     from "./health.js";
import authRouter       from "./auth.js";
import exchangesRouter  from "./exchanges.js";
import ordersRouter     from "./orders.js";
import pnlRouter        from "./pnl.js";
import strategiesRouter from "./strategies.js";
import configRouter     from "./config.js";
import futuresRouter    from "./futures.js";
import riskRouter       from "./risk.js";
import aiRouter         from "./ai.js";
import pluginsRouter    from "./plugins.js";
import backtestRouter   from "./backtest.js";
import metricsRouter    from "./metrics.js";
import signalsRouter    from "./signals.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth",       authRouter);
router.use("/exchanges",  exchangesRouter);
router.use("/orders",     ordersRouter);
router.use("/pnl",        pnlRouter);
router.use("/strategies", strategiesRouter);
router.use("/config",     configRouter);
router.use("/futures",    futuresRouter);
router.use("/risk",       riskRouter);
router.use("/ai",         aiRouter);
router.use("/plugins",    pluginsRouter);
router.use("/backtest",   backtestRouter);
router.use("/metrics",    metricsRouter);
router.use("/signals",    signalsRouter);

export default router;
