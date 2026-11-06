// Staff portal: login with Netlify Identity, then manage passages and read the chat log.
// Bundled to site/staff/staff.js at build time (see package.json "build").
import {
  login,
  logout,
  getUser,
  handleAuthCallback,
  acceptInvite,
  updateUser,
  requestPasswordRecovery,
  AuthError,
  MissingIdentityError,
} from "@netlify/identity";

type Passage = {
  id: number; category: string; title: string; titleHi: string; text: string; textHi: string;
  source: string; status: string; seed: boolean; createdBy: string; approvedBy: string; updatedAt: string;
};
type Log = { id: number; question: string; lang: string; answered: boolean; matched: string; createdAt: string };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const VIEWS = ["vLogin", "vForgot", "vSetPw", "vNoRole", "vDash"];
const show = (v: string) => VIEWS.forEach((x) => ($(x).hidden = x !== v));
const el = (tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function flash(msg: string, err = false) {
  const f = $("flash");
  f.textContent = msg;
  f.className = err ? "flash err" : "flash";
  f.hidden = !msg;
  if (msg) window.scrollTo({ top: 0, behavior: "smooth" });
}
function errMsg(e: unknown) {
  if (e instanceof MissingIdentityError) return "Login is not enabled on this site yet.";
  if (e instanceof AuthError) {
    if (e.status === 401) return "Wrong email or password.";
    if (e.status === 422) return "Please check what you entered (password needs at least 10 characters).";
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api/staff/${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { show("vLogin"); throw new Error("Your session ended. Please log in again."); }
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data as T;
}

/* ---------------- state ---------------- */
let roles: string[] = [];
let passages: Passage[] = [];
let statusFilter = "pending";
const canWrite = () => roles.some((r) => ["admin", "approver", "editor"].includes(r));
const canApprove = () => roles.some((r) => ["admin", "approver"].includes(r));
const canDelete = () => roles.includes("admin");

/* ---------------- auth flows ---------------- */
let inviteToken = "";
let setPwMode: "invite" | "recovery" = "invite";

async function boot() {
  try {
    const result = await handleAuthCallback();
    if (result) {
      history.replaceState(null, "", location.pathname);
      if (result.type === "invite") {
        inviteToken = result.token ?? "";
        setPwMode = "invite";
        $("setPwTitle").textContent = "Welcome! Choose a password";
        return show("vSetPw");
      }
      if (result.type === "recovery") {
        setPwMode = "recovery";
        $("setPwTitle").textContent = "Choose a new password";
        return show("vSetPw");
      }
      if (result.type === "confirmation") flash("Email confirmed.");
    }
  } catch (e) {
    flash(errMsg(e), true);
  }
  const user = await getUser();
  if (user) return enter();
  show("vLogin");
}

async function enter() {
  try {
    const me = await api<{ email: string; roles: string[] }>("me");
    roles = me.roles;
    showWho(me.email, roles);
    show("vDash");
    $("newBtn").hidden = !canWrite();
    await loadPassages();
  } catch (e) {
    const u = await getUser();
    if (u && /no staff role/i.test(String((e as Error).message))) {
      showWho(u.email ?? "", []);
      return show("vNoRole");
    }
    if (u) flash(errMsg(e), true);
  }
}

function showWho(email: string, rs: string[]) {
  $("who").hidden = false;
  $("whoEmail").textContent = email;
  const box = $("whoRoles");
  box.replaceChildren(...rs.map((r) => el("span", "role", r)));
}

$("fLogin").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target as HTMLFormElement);
  flash("");
  try {
    await login(String(f.get("email")), String(f.get("password")));
    (ev.target as HTMLFormElement).reset();
    await enter();
  } catch (e) { flash(errMsg(e), true); }
});

$("fForgot").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target as HTMLFormElement);
  try {
    await requestPasswordRecovery(String(f.get("email")));
    flash("If that email has an account, a reset link is on its way.");
    show("vLogin");
  } catch (e) { flash(errMsg(e), true); }
});

$("fSetPw").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const pw = String(new FormData(ev.target as HTMLFormElement).get("password"));
  try {
    if (setPwMode === "invite") await acceptInvite(inviteToken, pw);
    else await updateUser({ password: pw });
    flash("Password saved. You are logged in.");
    await enter();
  } catch (e) { flash(errMsg(e), true); }
});

$("toForgot").addEventListener("click", () => show("vForgot"));
document.querySelectorAll<HTMLElement>("[data-show]").forEach((b) => b.addEventListener("click", () => show(b.dataset.show!)));
$("logout").addEventListener("click", async () => {
  try { await logout(); } catch { /* ignore */ }
  roles = [];
  $("who").hidden = true;
  flash("");
  show("vLogin");
});

/* ---------------- tabs ---------------- */
document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    document.querySelectorAll<HTMLElement>(".tab").forEach((t) => (t.hidden = t.id !== b.dataset.tab));
    if (b.dataset.tab === "tLogs") loadLogs().catch((e) => flash(errMsg(e), true));
  }),
);

/* ---------------- passages ---------------- */
async function loadPassages() {
  passages = (await api<{ passages: Passage[] }>("passages")).passages;
  renderPassages();
}

const STATUS_LABEL: Record<string, string> = { approved: "Live", pending: "Pending approval", archived: "Archived" };

function renderPassages() {
  document.querySelectorAll<HTMLButtonElement>("#statusFilter .pill").forEach((b) => {
    const s = b.dataset.status!;
    const n = s ? passages.filter((p) => p.status === s).length : passages.length;
    b.classList.toggle("on", s === statusFilter);
    b.replaceChildren(b.dataset.label ?? (b.dataset.label = b.textContent ?? ""), el("span", "n", `(${n})`));
  });
  const list = $("plist");
  const rows = passages.filter((p) => !statusFilter || p.status === statusFilter);
  if (!rows.length) return list.replaceChildren(el("p", "empty", "Nothing here."));
  list.replaceChildren(
    ...rows.map((p) => {
      const it = el("div", "item");
      const meta = el("div", "meta");
      meta.append(el("span", `tag ${p.status}`, STATUS_LABEL[p.status] ?? p.status), el("span", "tag cat", p.category));
      if (p.createdBy) meta.append(`Added by ${p.createdBy}`);
      if (p.approvedBy && p.status === "approved") meta.append(` · Approved by ${p.approvedBy}`);
      if (p.seed && !p.createdBy) meta.append("Starter passage");
      it.append(meta, el("h4", undefined, p.title));
      if (p.titleHi) it.append(el("div", "hi", p.titleHi));
      it.append(el("p", undefined, p.text));
      if (p.textHi) it.append(el("p", "hi", p.textHi));
      if (p.source) it.append(el("div", "muted", `Source: ${p.source}`));
      const act = el("div", "actions");
      const btn = (label: string, cls: string, fn: () => void) => {
        const b = el("button", cls, label) as HTMLButtonElement;
        b.type = "button";
        b.onclick = fn;
        act.append(b);
      };
      if (canApprove() && p.status !== "approved") btn("✓ Approve", "ok", () => setStatus(p, "approved"));
      if (canApprove() && p.status !== "archived") btn("Archive", "", () => setStatus(p, "archived"));
      if (canWrite()) btn("Edit", "", () => openEditor(p));
      if (canDelete()) btn("Delete", "del", () => remove(p));
      if (act.childElementCount) it.append(act);
      return it;
    }),
  );
}

document.querySelectorAll<HTMLButtonElement>("#statusFilter .pill").forEach((b) =>
  b.addEventListener("click", () => { statusFilter = b.dataset.status!; renderPassages(); }),
);

async function setStatus(p: Passage, status: string) {
  try {
    await api(`passages/${p.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    flash(status === "approved" ? `“${p.title}” is now live for trainees.` : `“${p.title}” archived.`);
    await loadPassages();
  } catch (e) { flash(errMsg(e), true); }
}

async function remove(p: Passage) {
  if (!confirm(`Delete “${p.title}” permanently?`)) return;
  try {
    await api(`passages/${p.id}`, { method: "DELETE" });
    flash("Passage deleted.");
    await loadPassages();
  } catch (e) { flash(errMsg(e), true); }
}

const form = $<HTMLFormElement>("fEdit");
function openEditor(p?: Passage) {
  form.reset();
  form.hidden = false;
  $("editTitle").textContent = p ? "Edit passage" : "New passage";
  const set = (n: string, v: string) => ((form.elements.namedItem(n) as HTMLInputElement).value = v);
  set("id", p ? String(p.id) : "");
  if (p) (["category", "title", "titleHi", "text", "textHi", "source"] as const).forEach((k) => set(k, p[k] ?? ""));
  $("editNote").textContent = canApprove()
    ? "As an approver, your changes go live immediately."
    : "Your changes will be saved as Pending and go live after an approver approves them.";
  form.scrollIntoView({ behavior: "smooth" });
}
$("newBtn").addEventListener("click", () => openEditor());
$("cancelEdit").addEventListener("click", () => (form.hidden = true));
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
  const id = data.id;
  delete data.id;
  try {
    if (id) await api(`passages/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    else await api("passages", { method: "POST", body: JSON.stringify(data) });
    form.hidden = true;
    flash(canApprove() ? "Saved and live." : "Saved. Waiting for an approver.");
    statusFilter = canApprove() ? "approved" : "pending";
    await loadPassages();
  } catch (e) { flash(errMsg(e), true); }
});

/* ---------------- chat log ---------------- */
let logs: Log[] = [];
async function loadLogs() {
  const d = await api<{ stats: { total: number; unanswered: number }; logs: Log[] }>("chat-logs");
  logs = d.logs;
  $("logStats").textContent = `${d.stats.total} questions asked in total, ${d.stats.unanswered} not answered. Showing the latest ${logs.length}.`;
  renderLogs();
}
function renderLogs() {
  const only = $<HTMLInputElement>("onlyUnanswered").checked;
  const rows = logs.filter((l) => !only || !l.answered);
  const body = $("logRows");
  if (!rows.length) {
    const tr = el("tr"); const td = el("td", "empty", "No questions yet.") as HTMLTableCellElement; td.colSpan = 4; tr.append(td);
    return body.replaceChildren(tr);
  }
  body.replaceChildren(
    ...rows.map((l) => {
      const tr = el("tr", l.answered ? "" : "no");
      tr.append(
        el("td", undefined, new Date(l.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })),
        el("td", undefined, l.question),
        el("td", undefined, l.lang === "hi" ? "हिंदी" : "English"),
        el("td", undefined, l.answered ? l.matched : "— not answered"),
      );
      return tr;
    }),
  );
}
$("onlyUnanswered").addEventListener("change", renderLogs);

boot();
