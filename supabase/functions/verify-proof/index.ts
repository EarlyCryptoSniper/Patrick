// AI referee for photo proof. Called by the client instead of
// finalize_proof directly (that RPC's authenticated grant was revoked in
// 20260908010000_phase2_ai_referee.sql) — this is now the only path that
// can move a commitment from locked to completed.
//
// Flow: verify the caller owns a locked, not-yet-overdue commitment ->
// sign a short-lived URL for the uploaded photo -> ask an OpenAI vision
// model whether the photo plausibly shows the claimed task done -> on
// pass, call finalize_proof with the service-role key (bypasses the now
// client-revoked grant); on fail, delete the rejected upload and leave
// the commitment locked so the user can try again before the deadline.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openaiKey) return json({ error: "referee_unavailable", reason: "OPENAI_API_KEY not configured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "not_authenticated" }, 401);

  let body: { commitment_id?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { commitment_id, path } = body;
  if (!commitment_id || !path) return json({ error: "commitment_id_and_path_required" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: commitment, error: fetchError } = await admin
    .from("commitments")
    .select("*")
    .eq("id", commitment_id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !commitment) return json({ error: "not_found" }, 404);
  if (commitment.status !== "locked") {
    return json({ error: "invalid_state", reason: `status is ${commitment.status}, expected locked` }, 409);
  }
  if (new Date(commitment.deadline) < new Date()) {
    return json({ error: "deadline_passed" }, 409);
  }

  const { data: signed, error: signError } = await admin.storage
    .from("commitment-proofs")
    .createSignedUrl(path, 60);
  if (signError || !signed) return json({ error: "photo_unreadable" }, 500);

  let verdict: "pass" | "fail";
  let reason: string;
  try {
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Je bent een strenge maar redelijke scheidsrechter voor LockIn, een habit-commitment app. ' +
              'De gebruiker beweert deze taak te hebben afgerond: geef het voordeel van de twijfel bij een ' +
              'gewone, niet-tegenstrijdige foto; keur alleen af als de foto duidelijk niets met de taak te ' +
              'maken heeft, leeg is, of een stockfoto/meme is. Antwoord ALLEEN met JSON: ' +
              '{"verdict":"pass"|"fail","reason":"<één korte zin, in het Nederlands>"}.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Taak: "${commitment.title}". Toont deze foto bewijs dat dit is gedaan?` },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) throw new Error(`OpenAI ${aiResponse.status}`);
    const aiJson = await aiResponse.json();
    const parsed = JSON.parse(aiJson.choices[0].message.content);
    verdict = parsed.verdict === "pass" ? "pass" : "fail";
    reason = String(parsed.reason ?? "");
  } catch (err) {
    return json({ error: "referee_unavailable", reason: String(err) }, 502);
  }

  if (verdict === "fail") {
    await admin.storage.from("commitment-proofs").remove([path]);
    return json({ verdict, reason });
  }

  const { data: updated, error: finalizeError } = await admin.rpc("finalize_proof", {
    p_id: commitment_id,
    p_proof_path: path,
  });
  if (finalizeError) return json({ error: "finalize_failed", reason: finalizeError.message }, 500);

  return json({ verdict, reason, commitment: updated });
});
