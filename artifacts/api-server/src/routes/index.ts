import { Router, type IRouter } from "express";
import healthRouter from "./health";
import instructorsRouter from "./instructors";
import sessionsRouter from "./sessions";
import servicesRouter from "./services";
import availabilityRouter from "./availability";
import publicRouter from "./public";
import paymentsRouter from "./payments";
import connectRouter from "./connect";
import adminRouter from "./admin";
import securityRouter from "./security";
import clientsRouter from "./clients";
import profileRouter from "./profile";
import notionRouter from "./notion";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/clients", clientsRouter);
router.use("/instructors", instructorsRouter);
router.use("/instructor/connect", connectRouter);
router.use("/instructor/profile", profileRouter);
router.use("/sessions", sessionsRouter);
router.use("/services", servicesRouter);
router.use("/availability", availabilityRouter);
router.use("/public", publicRouter);
router.use("/payments", paymentsRouter);
router.use("/admin", adminRouter);
router.use("/security", securityRouter);
router.use("/notion", notionRouter);

export default router;
