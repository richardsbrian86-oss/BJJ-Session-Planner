import { Router } from "express";
import type { Request, Response } from "express";
import { db, instructorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireInstructor } from "../lib/auth";
import { instructorLimiter } from "../lib/rateLimiters";

const router = Router();

router.get("/", requireInstructor, instructorLimiter, async (req: Request, res: Response) => {
  const instructorId = req.instructorId!;

  const [instructor] = await db
    .select({
      id: instructorsTable.id,
      name: instructorsTable.name,
      slug: instructorsTable.slug,
      bio: instructorsTable.bio,
      location: instructorsTable.location,
      phone: instructorsTable.phone,
      website: instructorsTable.website,
      photoUrl: instructorsTable.photoUrl,
    })
    .from(instructorsTable)
    .where(eq(instructorsTable.id, instructorId))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  res.json({ profile: instructor });
});

router.put("/", requireInstructor, instructorLimiter, async (req: Request, res: Response) => {
  const instructorId = req.instructorId!;

  const { name, bio, location, phone, website, photoUrl } = req.body as {
    name?: string;
    bio?: string;
    location?: string;
    phone?: string;
    website?: string;
    photoUrl?: string;
  };

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    res.status(400).json({ error: "name must be a non-empty string" });
    return;
  }

  const updates: Partial<typeof instructorsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name.trim();
  if (bio !== undefined) updates.bio = bio || null;
  if (location !== undefined) updates.location = location || null;
  if (phone !== undefined) updates.phone = phone || null;
  if (website !== undefined) updates.website = website || null;
  if (photoUrl !== undefined) updates.photoUrl = photoUrl || null;

  const [updated] = await db
    .update(instructorsTable)
    .set(updates)
    .where(eq(instructorsTable.id, instructorId))
    .returning({
      id: instructorsTable.id,
      name: instructorsTable.name,
      slug: instructorsTable.slug,
      bio: instructorsTable.bio,
      location: instructorsTable.location,
      phone: instructorsTable.phone,
      website: instructorsTable.website,
      photoUrl: instructorsTable.photoUrl,
    });

  if (!updated) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  res.json({ profile: updated });
});

export default router;
