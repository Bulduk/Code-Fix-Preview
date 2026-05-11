import { Router, type IRouter } from "express";
import healthRouter     from "./health.js";
import authRouter       from "./auth.js";
import exchangesRouter  from "./exchanges.js";
import ordersRouter     from "./orders.js";
import pnlRouter        from "./pnl.js";
import strategiesRouter from "./strategies.js";
import configRouter     from "./config.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth",       authRouter);
router.use("/exchanges",  exchangesRouter);
router.use("/orders",     ordersRouter);
router.use("/pnl",        pnlRouter);
router.use("/strategies", strategiesRouter);
router.use("/config",     configRouter);

export default router;
