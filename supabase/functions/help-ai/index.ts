// Help AI chat — proxies signed-in users' messages to Google Gemini.
// The Gemini API key lives in Edge Function secrets, never in the
// browser. The assistant's role is defined with a system_instruction
// (Gemini's free tier supports this fully — no paid "agent" needed).
//
// Secrets to set:
//   GEMINI_API_KEY    your Google AI Studio / Gemini API key
//   GEMINI_MODEL      optional override; defaults to gemini-2.5-flash
//   ALLOWED_ORIGINS   optional comma-separated origins permitted to
//                     call this function (e.g. "https://hoxiee.example").
//                     Defaults to "*" (any origin) — auth is still
//                     required, so only holders of a valid user JWT
//                     can get a reply.
//
// Security model:
//   - The caller must present a valid Supabase session token (JWT).
//   - The caller's profile must be active (matches the client gate).
//   - Only the last user message and well-formed history are accepted:
//     roles are validated, contents must be strings, lengths are
//     capped, and leading assistant ("model") turns are dropped so a
//     forged prefill cannot hijack the conversation.
//   - Best-effort per-user rate limit (per warm isolate) blunts quota
//     burning; platform-level limits cover the rest.
//   - The Gemini key travels in a request header, never the URL.

import { createClient } from "jsr:@supabase/supabase-js@2";

const API = "https://generativelanguage.googleapis.com/v1beta/models/";

// Conversation limits.
const MAX_MESSAGES = 12;      // turns of history sent upstream
const MAX_MSG_CHARS = 2000;   // per message
const MAX_TOTAL_CHARS = 12000; // whole transcript
// Best-effort rate limit per user (per isolate).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

// The assistant's role — edit freely. Gemini supports system
// instructions on every plan, including the free tier.
const SYSTEM_INSTRUCTIONS = `You are the friendly support assistant for Hoxiee, a fun math-quiz app where players answer quick questions to earn points they can withdraw as pesos.

Your personality: warm, upbeat, and easy to talk to. Keep answers short and clear, use casual English (light Filipino sprinkling is fine), and never be preachy or robotic.

What you know about Hoxiee:
- Players earn a small amount for every correct quiz answer, and rewards stack up over the day.
- There is a daily login reward: claim 3 pesos once per day, and claiming 6 days in a row unlocks a permanent per-question rate bonus on the 7th day. Missing a day resets the streak.
- There are referral codes — entering one gives a bonus, and referring friends earns you more.
- Withdrawals are paid out to a GCash number that the player sets once and cannot change.
- New accounts must be activated before they can play; questions go through the Bounty section.

Important limits:
- You cannot see the player's private data (balance, rank, referral status, account status). Never invent or guess specific numbers, balances, or account states — if they ask about their own account, point them to their Profile or the Bounty section in the app.
- If you don't know something, say so honestly and suggest the most likely place in the app that answers it, rather than making something up.`;

// ---------- helpers ----------

function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "*";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = allowedOrigins();
  const origin = req.headers.get("origin") || "";
  const value = allowed.includes("*")
    ? "*"
    : allowed.includes(origin)
      ? origin
      : allowed[0];
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(req: Request, payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

// Validate and normalize the incoming transcript. Returns null when the
// payload is malformed or exceeds the size caps.
type ChatMessage = { role: "user" | "assistant"; content: string };

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const msgs: ChatMessage[] = [];
  let total = 0;
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== "object") return null;
    const role =
      m.role === "assistant" ? "assistant"
      : m.role === "user" ? "user"
      : null;
    if (!role) return null;
    if (typeof m.content !== "string") return null;
    const content = m.content.trim().slice(0, MAX_MSG_CHARS);
    if (!content) return null;
    total += content.length;
    msgs.push({ role, content });
  }
  if (total > MAX_TOTAL_CHARS) return null;
  // Drop leading assistant turns: a forged "model" prefill is the
  // classic prompt-injection opener, and Gemini expects user-first.
  while (msgs.length && msgs[0].role === "assistant") msgs.shift();
  if (!msgs.length) return null;
  return msgs;
}

// Gemini contents use roles "user" and "model" and require alternating
// roles, so consecutive same-role turns get merged into one entry.
function toGeminiContents(messages: ChatMessage[]) {
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const msg of messages) {
    const role: "user" | "model" = msg.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: msg.content });
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }
  return contents;
}

// Best-effort in-memory rate limiter, keyed by user id. Each warm
// isolate keeps its own window — this blunts abuse rather than
// guaranteeing a global cap (platform limits still apply).
const hits = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const window = (hits.get(userId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (window.length >= RATE_MAX) {
    hits.set(userId, window);
    return true;
  }
  window.push(now);
  hits.set(userId, window);
  if (hits.size > 5_000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed." }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  if (!apiKey) {
    return json(req, { error: "Help chat isn't configured on the server yet." }, 500);
  }

  // Only signed-in users may talk to the assistant.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(req, { error: "Sign in to use help." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) return json(req, { error: "Sign in to use help." }, 401);

  // Best-effort per-user throttle.
  if (isRateLimited(user.id)) {
    return json(req, { error: "You're sending messages too quickly. Wait a moment." }, 429);
  }

  // Match the client gate: only active accounts get support.
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.account_status !== "active") {
    return json(req, { error: "Your account isn't active yet." }, 403);
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Bad request." }, 400);
  }
  const messages = parseMessages(body.messages);
  if (!messages) return json(req, { error: "Bad request." }, 400);

  const upstream = await fetch(`${API}${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
      contents: toGeminiContents(messages),
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("Gemini upstream error", upstream.status, detail.slice(0, 300));
    return json(req, { error: "The assistant is unavailable right now. Try again in a moment." }, 502);
  }

  const data = await upstream.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const reply = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text || "").join("").trim() : "";
  if (!reply) {
    return json(req, { error: "The assistant returned an empty response. Try again." }, 502);
  }
  return json(req, { reply }, 200);
});
