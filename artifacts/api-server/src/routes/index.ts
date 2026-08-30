import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fleetRouter from "./fleet";
import tripsRouter from "./trips";
import emergenciesRouter from "./emergencies";
import suppliesRouter from "./supplies";
import geocodingRouter from "./geocoding";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fleetRouter);
router.use(tripsRouter);
router.use(emergenciesRouter);
router.use(suppliesRouter);
router.use(geocodingRouter);

export default router;
