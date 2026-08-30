import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";
import {
  ApproveDriverApplicationParams,
  ApproveDriverApplicationResponse,
  CreateDriverApplicationBody,
  CreateDriverApplicationResponse,
  CreateDriverReviewBody,
  CreateDriverReviewParams,
  CreateDriverReviewResponse,
  GetDriverProfileParams,
  GetDriverProfileResponse,
  ListDriverApplicationsQueryParams,
  ListDriverApplicationsResponse,
  ListDriverReviewsParams,
  ListDriverReviewsResponse,
  RejectDriverApplicationBody,
  RejectDriverApplicationParams,
  RejectDriverApplicationResponse,
} from "@workspace/api-zod";
import {
  boatsTable,
  db,
  driverApplicationsTable,
  driverReviewsTable,
  driversTable,
  tripsTable,
} from "@workspace/db";
import { toApiDriver } from "../lib/fleet";

const router: IRouter = Router();
const REVIEW_PAGE_SIZE = 5;

function errorBody(error: string, code: string, field: string | null = null) {
  return { error, code, field };
}

function requireReviewer(req: Parameters<typeof getAuth>[0], res: { status: (code: number) => { json: (body: unknown) => void } }) {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json(errorBody("Sign in to review captain applications.", "AUTH_REQUIRED"));
    return null;
  }
  return auth;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

function validationError(result: { error: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  const issue = result.error.issues[0];
  return errorBody(issue?.message ?? "Check the highlighted fields.", "VALIDATION_ERROR", String(issue?.path[0] ?? "") || null);
}

function applicationResponse(application: typeof driverApplicationsTable.$inferSelect) {
  return {
    ...application,
    boatClasses: application.boatClasses as Array<"water_taxi" | "cruiser" | "catamaran" | "speedboat">,
    certifications: application.certifications as Array<"medical" | "tow" | "night_ops">,
  };
}

async function reviewEligibility(userId: string | null, driverId: string) {
  if (!userId) return { canReview: false, reviewBlockReason: "Sign in to review this captain." };
  const [existing] = await db
    .select()
    .from(driverReviewsTable)
    .where(and(eq(driverReviewsTable.driverId, driverId), eq(driverReviewsTable.reviewerId, userId)));
  if (existing) return { canReview: false, reviewBlockReason: "You have already reviewed this captain." };

  const riderTrips = await db.select().from(tripsTable).where(eq(tripsTable.riderId, userId));
  const driverBoats = await db.select().from(boatsTable).where(eq(boatsTable.driverId, driverId));
  const boatIds = new Set(driverBoats.map((boat) => boat.id));
  const eligible = riderTrips.some((trip) => trip.status === "completed" && boatIds.has(trip.boatId));
  return eligible
    ? { canReview: true, reviewBlockReason: null }
    : { canReview: false, reviewBlockReason: "Complete a trip with this captain before leaving a review." };
}

router.post("/drivers/applications", async (req, res): Promise<void> => {
  const parsed = CreateDriverApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(validationError(parsed));
    return;
  }
  const [duplicate] = await db
    .select()
    .from(driverApplicationsTable)
    .where(ilike(driverApplicationsTable.email, parsed.data.email.trim()));
  if (duplicate && duplicate.status !== "rejected") {
    res.status(409).json(errorBody("An active application already exists for this email.", "DUPLICATE_APPLICATION", "email"));
    return;
  }
  const id = `application-${Date.now().toString(36)}`;
  let application: typeof driverApplicationsTable.$inferSelect;
  try {
    [application] = await db.insert(driverApplicationsTable).values({
      ...parsed.data,
      fullName: parsed.data.fullName.trim(),
      email: parsed.data.email.trim().toLowerCase(),
      phone: parsed.data.phone.trim(),
      availability: parsed.data.availability.trim(),
      experience: parsed.data.experience.trim(),
      safetyRecord: parsed.data.safetyRecord.trim(),
      motivation: parsed.data.motivation.trim(),
      id,
    }).returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json(errorBody("An application already exists for this email.", "DUPLICATE_APPLICATION", "email"));
      return;
    }
    throw error;
  }
  res.status(201).json(CreateDriverApplicationResponse.parse(applicationResponse(application)));
});

router.get("/drivers/applications", async (req, res): Promise<void> => {
  if (!requireReviewer(req, res)) return;
  const parsed = ListDriverApplicationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(validationError(parsed));
    return;
  }
  const applications = await db
    .select()
    .from(driverApplicationsTable)
    .where(parsed.data.status ? eq(driverApplicationsTable.status, parsed.data.status) : undefined)
    .orderBy(desc(driverApplicationsTable.createdAt));
  res.json(ListDriverApplicationsResponse.parse(applications.map(applicationResponse)));
});

router.post("/drivers/applications/:applicationId/approve", async (req, res): Promise<void> => {
  if (!requireReviewer(req, res)) return;
  const params = ApproveDriverApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json(validationError(params));
    return;
  }
  const driverId = `driver-${Date.now().toString(36)}`;
  const result = await db.transaction(async (tx) => {
    const [application] = await tx.update(driverApplicationsTable).set({
      status: "approved",
      reviewedAt: new Date(),
      rejectionReason: null,
    }).where(and(
      eq(driverApplicationsTable.id, params.data.applicationId),
      eq(driverApplicationsTable.status, "pending"),
    )).returning();
    if (!application) return null;
    const initials = application.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
    const [driver] = await tx.insert(driversTable).values({
      id: driverId,
      name: application.fullName,
      avatar: initials,
      rating: 0,
      tripsCompleted: 0,
      yearsActive: application.yearsExperience,
      languages: application.languages,
      certifications: application.certifications,
    }).returning();
    const [updated] = await tx.update(driverApplicationsTable).set({
      driverId,
    }).where(eq(driverApplicationsTable.id, application.id)).returning();
    return { application: updated, driver };
  });
  if (!result) {
    const [existing] = await db.select({ status: driverApplicationsTable.status })
      .from(driverApplicationsTable)
      .where(eq(driverApplicationsTable.id, params.data.applicationId));
    res.status(existing ? 409 : 404).json(errorBody(
      existing ? "Only pending applications can be approved." : "Application not found.",
      existing ? "APPLICATION_ALREADY_REVIEWED" : "APPLICATION_NOT_FOUND",
    ));
    return;
  }
  res.json(ApproveDriverApplicationResponse.parse({
    application: applicationResponse(result.application),
    driver: toApiDriver(result.driver),
  }));
});

router.post("/drivers/applications/:applicationId/reject", async (req, res): Promise<void> => {
  if (!requireReviewer(req, res)) return;
  const params = RejectDriverApplicationParams.safeParse(req.params);
  const body = RejectDriverApplicationBody.safeParse(req.body ?? {});
  if (!params.success) {
    res.status(400).json(validationError(params));
    return;
  }
  if (!body.success) {
    res.status(400).json(validationError(body));
    return;
  }
  const [updated] = await db.update(driverApplicationsTable).set({
    status: "rejected",
    rejectionReason: body.data.reason?.trim() || "Application did not meet current fleet needs.",
    reviewedAt: new Date(),
  }).where(and(
    eq(driverApplicationsTable.id, params.data.applicationId),
    eq(driverApplicationsTable.status, "pending"),
  )).returning();
  if (!updated) {
    const [existing] = await db.select({ status: driverApplicationsTable.status })
      .from(driverApplicationsTable)
      .where(eq(driverApplicationsTable.id, params.data.applicationId));
    res.status(existing ? 409 : 404).json(errorBody(
      existing ? "Only pending applications can be rejected." : "Application not found.",
      existing ? "APPLICATION_ALREADY_REVIEWED" : "APPLICATION_NOT_FOUND",
    ));
    return;
  }
  res.json(RejectDriverApplicationResponse.parse({ application: applicationResponse(updated), driver: null }));
});

router.get("/drivers/:driverId", async (req, res): Promise<void> => {
  const params = GetDriverProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json(validationError(params));
    return;
  }
  const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, params.data.driverId));
  if (!driver) {
    res.status(404).json(errorBody("Driver not found.", "DRIVER_NOT_FOUND"));
    return;
  }
  const reviews = await db.select().from(driverReviewsTable).where(eq(driverReviewsTable.driverId, driver.id));
  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  reviews.forEach((review) => { distribution[String(review.rating)] = (distribution[String(review.rating)] ?? 0) + 1; });
  const eligibility = await reviewEligibility(getAuth(req).userId, driver.id);
  res.json(GetDriverProfileResponse.parse({
    ...toApiDriver(driver, reviews.map((review) => review.rating)),
    reviewCount: reviews.length,
    distribution,
    ...eligibility,
  }));
});

router.get("/drivers/:driverId/reviews/page/:page", async (req, res): Promise<void> => {
  const params = ListDriverReviewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json(validationError(params));
    return;
  }
  const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, params.data.driverId));
  if (!driver) {
    res.status(404).json(errorBody("Driver not found.", "DRIVER_NOT_FOUND"));
    return;
  }
  const allReviews = await db.select().from(driverReviewsTable)
    .where(eq(driverReviewsTable.driverId, driver.id))
    .orderBy(desc(driverReviewsTable.createdAt), asc(driverReviewsTable.id));
  const offset = (params.data.page - 1) * REVIEW_PAGE_SIZE;
  res.json(ListDriverReviewsResponse.parse({
    reviews: allReviews.slice(offset, offset + REVIEW_PAGE_SIZE),
    page: params.data.page,
    pageSize: REVIEW_PAGE_SIZE,
    total: allReviews.length,
    hasNext: offset + REVIEW_PAGE_SIZE < allReviews.length,
  }));
});

router.post("/drivers/:driverId/reviews", async (req, res): Promise<void> => {
  const params = CreateDriverReviewParams.safeParse(req.params);
  const body = CreateDriverReviewBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json(validationError(params));
    return;
  }
  if (!body.success) {
    res.status(400).json(validationError(body));
    return;
  }
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json(errorBody("Sign in to review this captain.", "AUTH_REQUIRED"));
    return;
  }
  const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, params.data.driverId));
  if (!driver) {
    res.status(404).json(errorBody("Driver not found.", "DRIVER_NOT_FOUND"));
    return;
  }
  const eligibility = await reviewEligibility(auth.userId, driver.id);
  if (!eligibility.canReview) {
    const duplicate = eligibility.reviewBlockReason?.includes("already reviewed");
    res.status(duplicate ? 409 : 400).json(errorBody(
      eligibility.reviewBlockReason ?? "You cannot review this captain.",
      duplicate ? "DUPLICATE_REVIEW" : "TRIP_REQUIRED",
    ));
    return;
  }
  const claims = auth.sessionClaims as Record<string, unknown> | null;
  const firstName = typeof claims?.first_name === "string" ? claims.first_name : null;
  let review: typeof driverReviewsTable.$inferSelect;
  try {
    [review] = await db.insert(driverReviewsTable).values({
      id: `review-${Date.now().toString(36)}`,
      driverId: driver.id,
      reviewerId: auth.userId,
      reviewerName: firstName || "Verified passenger",
      rating: body.data.rating,
      body: body.data.body.trim(),
    }).returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json(errorBody("You have already reviewed this captain.", "DUPLICATE_REVIEW"));
      return;
    }
    throw error;
  }
  res.status(201).json(CreateDriverReviewResponse.parse(review));
});

export default router;