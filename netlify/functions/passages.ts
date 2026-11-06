import type { Config } from "@netlify/functions";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { passages } from "../../db/schema.js";

// Public, read-only: the approved passages the chat answers from.
// Staff add, edit and approve passages through /api/staff/passages.
export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const rows = await db.select().from(passages).where(eq(passages.status, "approved")).orderBy(asc(passages.id));
  return Response.json(
    { passages: rows.map((r) => ({ c: r.category, t: r.title, ht: r.titleHi, x: r.text, h: r.textHi, s: r.source })) },
    { headers: { "Cache-Control": "no-store" } },
  );
};

export const config: Config = { path: "/api/passages" };
