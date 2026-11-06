import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { chatLogs } from "../../db/schema.js";

// Records each question asked in the chat (anonymous) so staff can see what
// trainees ask and which questions went unanswered.
export default async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }
  const question = String(body?.q ?? "").trim().slice(0, 500);
  if (!question) return Response.json({ error: "Empty question" }, { status: 400 });
  await db.insert(chatLogs).values({
    question,
    lang: body?.lang === "hi" ? "hi" : "en",
    answered: Boolean(body?.answered),
    matched: String(body?.matched ?? "").slice(0, 200),
  });
  return Response.json({ ok: true }, { status: 201 });
};

export const config: Config = { path: "/api/chat-log" };
