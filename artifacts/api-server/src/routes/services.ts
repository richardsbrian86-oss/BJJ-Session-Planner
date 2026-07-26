import { Router } from "express";
import type { Request, Response } from "express";
import { db, servicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireInstructor } from "../lib/auth";
import { instructorLimiter } from "../lib/rateLimiters";

const router = Router();

router.use(requireInstructor);
router.use(instructorLimiter);

router.get("/", async (req: Request, res: Response) => {
  const services = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.instructorId, req.instructorId!));
  res.json(services);
});

router.post("/", async (req: Request, res: Response) => {
  const { name, price } = req.body as { name?: string; price?: number };
  if (!name || price === undefined) {
    res.status(400).json({ error: "name and price are required" });
    return;
  }

  const [service] = await db
    .insert(servicesTable)
    .values({
      instructorId: req.instructorId!,
      name,
      price: Number(price),
    })
    .returning();

  res.status(201).json(service);
});

router.patch("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const serviceId = parseInt(req.params.id, 10);
  if (isNaN(serviceId)) {
    res.status(400).json({ error: "Invalid service ID" });
    return;
  }

  const { name, price } = req.body as { name?: string; price?: number };

  type ServicePatch = Partial<{ name: string; price: number }>;
  const updates: ServicePatch = {};
  if (name !== undefined) updates.name = name;
  if (price !== undefined) updates.price = Number(price);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(servicesTable)
    .set(updates)
    .where(
      and(
        eq(servicesTable.id, serviceId),
        eq(servicesTable.instructorId, req.instructorId!)
      )
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  res.json(updated);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const serviceId = parseInt(req.params.id, 10);
  if (isNaN(serviceId)) {
    res.status(400).json({ error: "Invalid service ID" });
    return;
  }

  const [deleted] = await db
    .delete(servicesTable)
    .where(
      and(
        eq(servicesTable.id, serviceId),
        eq(servicesTable.instructorId, req.instructorId!)
      )
    )
    .returning({ id: servicesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  res.status(204).send();
});

export default router;
