import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import portfolioRouter from "./portfolio";
import transactionsRouter from "./transactions";
import marketRouter from "./market";
import adminRouter from "./admin";
import settingsRouter from "./settings";
import investmentsRouter from "./investments";
import cronRouter from "./cron";
import loansRouter from "./loans";
import referralsRouter from "./referrals";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/portfolio", portfolioRouter);
router.use("/transactions", transactionsRouter);
router.use("/market", marketRouter);
router.use("/admin", adminRouter);
router.use("/settings", settingsRouter);
router.use(investmentsRouter);
router.use(cronRouter);
router.use(loansRouter);
router.use(referralsRouter);

export default router;
