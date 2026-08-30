import { Router, type IRouter, type Response } from "express";
import {
  AgeSupplyOrderParams,
  AgeSupplyOrderResponse,
  AttachEmergencySuppliesBody,
  AttachEmergencySuppliesParams,
  AttachEmergencySuppliesResponse,
  CancelSupplyOrderParams,
  CancelSupplyOrderResponse,
  CreateSupplyOrderBody,
  CreateSupplyOrderResponse,
  GetSupplyAvailabilityQueryParams,
  GetSupplyAvailabilityResponse,
  GetSupplyOrderParams,
  GetSupplyOrderResponse,
  GetSupplyQueueResponse,
  ListSupplyCatalogResponse,
  ListSupplyDepotsResponse,
  ResetDemoResponse,
} from "@workspace/api-zod";
import {
  ageSupplyOrderById,
  cancelSupplyOrderById,
  createSupplyOrder,
  getAvailability,
  getEmergencyDestination,
  getSupplyOrderById,
  listCatalog,
  listDepots,
  listSupplyQueue,
  resetSupplyDemo,
} from "../lib/supplies";

const router: IRouter = Router();

function sendSupplyError(res: Response, error: unknown) {
  const problem = error as { message?: string; status?: number; code?: string; remedy?: string };
  res.status(problem.status ?? 500).json({
    error: problem.message ?? "The supply channel went quiet.",
    code: problem.code ?? "SUPPLY_ERROR",
    ...(problem.remedy ? { remedy: problem.remedy } : {}),
  });
}

router.get("/supplies/catalog", async (_req, res) => {
  res.json(ListSupplyCatalogResponse.parse(await listCatalog()));
});

router.get("/supplies/depots", async (_req, res) => {
  res.json(ListSupplyDepotsResponse.parse(await listDepots()));
});

router.get("/supplies/availability", async (req, res) => {
  const parsed = GetSupplyAvailabilityQueryParams.safeParse(req.query);
  if (!parsed.success) return sendSupplyError(res, Object.assign(new Error(parsed.error.message), { status: 400, code: "INVALID_AVAILABILITY_QUERY" }));
  const data = await getAvailability(parsed.data.itemId, parsed.data.quantity, { lat: parsed.data.lat, lng: parsed.data.lng });
  res.json(GetSupplyAvailabilityResponse.parse(data));
});

router.post("/supplies/orders", async (req, res) => {
  const parsed = CreateSupplyOrderBody.safeParse(req.body);
  if (!parsed.success) return sendSupplyError(res, Object.assign(new Error(parsed.error.message), { status: 400, code: "INVALID_ORDER" }));
  try {
    res.status(201).json(CreateSupplyOrderResponse.parse(await createSupplyOrder(parsed.data)));
  } catch (error) {
    sendSupplyError(res, error);
  }
});

router.get("/supplies/orders/:supplyOrderId", async (req, res) => {
  const parsed = GetSupplyOrderParams.safeParse(req.params);
  if (!parsed.success) return sendSupplyError(res, Object.assign(new Error(parsed.error.message), { status: 400, code: "INVALID_ORDER_ID" }));
  const order = await getSupplyOrderById(parsed.data.supplyOrderId);
  if (!order) return sendSupplyError(res, Object.assign(new Error("That supply run is not in the log."), { status: 404, code: "ORDER_NOT_FOUND" }));
  res.json(GetSupplyOrderResponse.parse(order));
});

router.get("/supplies/queue", async (_req, res) => {
  res.json(GetSupplyQueueResponse.parse(await listSupplyQueue()));
});

router.post("/supplies/orders/:supplyOrderId/cancel", async (req, res) => {
  const parsed = CancelSupplyOrderParams.safeParse(req.params);
  if (!parsed.success) return sendSupplyError(res, Object.assign(new Error(parsed.error.message), { status: 400, code: "INVALID_ORDER_ID" }));
  try {
    const order = await cancelSupplyOrderById(parsed.data.supplyOrderId);
    if (!order) return sendSupplyError(res, Object.assign(new Error("That supply run is not in the log."), { status: 404, code: "ORDER_NOT_FOUND" }));
    res.json(CancelSupplyOrderResponse.parse(order));
  } catch (error) {
    sendSupplyError(res, error);
  }
});

router.post("/supplies/orders/:supplyOrderId/age", async (req, res) => {
  const parsed = AgeSupplyOrderParams.safeParse(req.params);
  if (!parsed.success) return sendSupplyError(res, Object.assign(new Error(parsed.error.message), { status: 400, code: "INVALID_ORDER_ID" }));
  try {
    const order = await ageSupplyOrderById(parsed.data.supplyOrderId);
    if (!order) return sendSupplyError(res, Object.assign(new Error("That supply run is not in the log."), { status: 404, code: "ORDER_NOT_FOUND" }));
    res.json(AgeSupplyOrderResponse.parse(order));
  } catch (error) {
    sendSupplyError(res, error);
  }
});

router.patch("/emergencies/:emergencyId/supplies", async (req, res) => {
  const [params, body] = [AttachEmergencySuppliesParams.safeParse(req.params), AttachEmergencySuppliesBody.safeParse(req.body)];
  if (!params.success || !body.success) return sendSupplyError(res, Object.assign(new Error("Choose at least one valid supply line."), { status: 400, code: "INVALID_ORDER" }));
  const destination = await getEmergencyDestination(params.data.emergencyId);
  if (!destination) return sendSupplyError(res, Object.assign(new Error("That response call is not in the log."), { status: 404, code: "EMERGENCY_NOT_FOUND" }));
  try {
    const order = await createSupplyOrder({ lines: body.data.lines, destinationPosition: destination, destinationIslandId: null, destinationDockId: null, urgency: "critical", accessibilityNeed: true, requesterNote: "Supplies attached to active response", linkedEmergencyId: params.data.emergencyId });
    res.status(201).json(AttachEmergencySuppliesResponse.parse(order));
  } catch (error) {
    sendSupplyError(res, error);
  }
});

router.post("/dev/reset", async (_req, res) => {
  try {
    await resetSupplyDemo();
    res.json(ResetDemoResponse.parse({ status: "reset" }));
  } catch (error) {
    sendSupplyError(res, error);
  }
});

export default router;