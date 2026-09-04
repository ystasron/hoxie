// Help AI chat — proxies signed-in users' messages to a Mistral custom
// agent. The Mistral API key lives in Edge Function secrets, never in
// the browser.
//
// Secrets to set:
//   MISTRAL_API_KEY   your Mistral API key
//   AGENT_ID          your Mistral custom agent id (ag_...)
//
// The caller must present a valid Supabase session token (the app sends
// the user's JWT), so strangers can't burn your Mistral quota.

import { createClient } from "jsr:@supabase/supabase-js@2";

const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/agents/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  const agentId = Deno.env.get("AGENT_ID");
  if (!apiKey || !agentId) {
    return json({ error: "Help chat isn't configured on the server yet." }, 500);
  }

  // Only signed-in users may talk to the assistant.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to use help." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "Sign in to use help." }, 401);

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (!messages.length) return json({ error: "No messages to send." }, 400);

  const upstream = await fetch(MISTRAL_ENDPOINT + encodeURIComponent(agentId) + "/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, temperature: 0.4, max_tokens: 600 }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("Mistral upstream error", upstream.status, detail.slice(0, 300));
    return json({ error: "The assistant is unavailable right now. Try again in a moment." }, 502);
  }

  const data = await upstream.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    return json({ error: "The assistant returned an empty response. Try again." }, 502);
  }
  return json({ reply }, 200);
});
