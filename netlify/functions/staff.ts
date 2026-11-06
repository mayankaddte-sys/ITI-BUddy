import type { Config, Context } from "@netlify/functions";
import { verifyRequestOrigin, AuthError } from "@netlify/identity";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { chatLogs, passages } from "../../db/schema.js";
import { can, getStaff, has } from "../lib/auth.js";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const cut = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const STATUSES = ["approved", "pending", "archived"];

function fields(p: any) {
  return {
    category: cut(p.category, 40) || "Other",
    title: cut(p.title, 200),
    titleHi: cut(p.titleHi, 200),
    text: cut(p.text, 5000),
    textHi: cut(p.textHi, 5000),
    source: cut(p.source, 250),
  };
}

export default async (req: Request, context: Context) => {
  const staff = await getStaff();
  if (!staff) return json({ error: "Please log in" }, 401);
  if (!has(staff, can.view)) return json({ error: "Your account has no staff role yet. Ask an admin to assign one." }, 403);

  if (req.method !== "GET") {
    try { verifyRequestOrigin(req); } catch (e) {
      if (e instanceof AuthError) return json({ error: "Bad origin" }, 403);
      throw e;
    }
  }

  const route = context.params.route ?? "";
  const [resource, idPart] = route.split("/");
  const id = idPart ? Number(idPart) : NaN;

  if (resource === "me" && req.method === "GET") {
    return json({ email: staff.email, name: staff.user.name ?? "", roles: staff.roles });
  }

  if (resource === "chat-logs" && req.method === "GET") {
    const rows = await db.select().from(chatLogs).orderBy(desc(chatLogs.createdAt)).limit(300);
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        unanswered: sql<number>`count(*) filter (where not ${chatLogs.answered})::int`,
      })
      .from(chatLogs);
    return json({ stats, logs: rows });
  }

  if (resource === "passages") {
    if (req.method === "GET") {
      return json({ passages: await db.select().from(passages).orderBy(asc(passages.category), asc(passages.id)) });
    }

    if (req.method === "POST") {
      if (!has(staff, can.write)) return json({ error: "Your role cannot add passages" }, 403);
      const p = fields(await req.json().catch(() => ({})));
      if (!p.title || !p.text) return json({ error: "Title and English text are required" }, 400);
      const approver = has(staff, can.approve);
      const [row] = await db
        .insert(passages)
        .values({ ...p, status: approver ? "approved" : "pending", createdBy: staff.email, approvedBy: approver ? staff.email : "" })
        .returning();
      return json({ passage: row }, 201);
    }

    if (!Number.isInteger(id)) return json({ error: "Passage id missing" }, 400);
    const [current] = await db.select().from(passages).where(eq(passages.id, id));
    if (!current) return json({ error: "Passage not found" }, 404);

    if (req.method === "PATCH") {
      const body = await req.json().catch(() => ({}));
      const update: Record<string, unknown> = { updatedAt: new Date() };
      if (body.status !== undefined) {
        if (!has(staff, can.approve)) return json({ error: "Only approvers can change status" }, 403);
        if (!STATUSES.includes(body.status)) return json({ error: "Unknown status" }, 400);
        update.status = body.status;
        if (body.status === "approved") update.approvedBy = staff.email;
      }
      if (body.title !== undefined || body.text !== undefined) {
        if (!has(staff, can.write)) return json({ error: "Your role cannot edit passages" }, 403);
        const p = fields({ ...current, ...body });
        if (!p.title || !p.text) return json({ error: "Title and English text are required" }, 400);
        Object.assign(update, p);
        // Edits by editors go back for approval, as in the Django workflow.
        if (!has(staff, can.approve)) { update.status = "pending"; update.approvedBy = ""; }
      }
      const [row] = await db.update(passages).set(update).where(eq(passages.id, id)).returning();
      return json({ passage: row });
    }

    if (req.method === "DELETE") {
      if (!has(staff, can.remove)) return json({ error: "Only admins can delete passages" }, 403);
      await db.delete(passages).where(eq(passages.id, id));
      return json({ ok: true });
    }
  }

  return json({ error: "Not found" }, 404);
};

export const config: Config = { path: "/api/staff/:route*" };
