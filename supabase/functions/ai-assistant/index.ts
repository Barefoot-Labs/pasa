const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not set");
    const sys = { role: "system", content: "You are the PASA Assistant — the official AI assistant for PASA, a South African school management app for parents and school staff. Always refer to the product as PASA (never 'Funda' or any other name). Be concise, friendly, and reference South African education context (CAPS curriculum, NSC, EMIS, terms 1-4) when relevant." };
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [sys, ...messages] }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: txt }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const j = await r.json();
    return new Response(JSON.stringify({ reply: j.choices?.[0]?.message?.content ?? "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
