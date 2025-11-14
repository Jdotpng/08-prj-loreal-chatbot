export default {
  async fetch(request, env) {
    // CORS headers so your frontend (index.html) can call this worker directly
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    // Respond to CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST for chat completions
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed. Use POST to call the worker.",
        }),
        { status: 405, headers: corsHeaders }
      );
    }

    // Ensure the API key is set in the worker environment (set via Cloudflare dashboard or `wrangler secret put OPENAI_API_KEY`)
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Server misconfigured: OPENAI_API_KEY is missing.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate messages array (we use messages param per workspace instructions)
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Request must include a non-empty `messages` array.",
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Build request for OpenAI Chat Completions
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const requestBody = {
      model: "gpt-4o",
      messages: messages,
      // Tunable parameters; keep reasonably constrained for cost and latency
      temperature:
        typeof body.temperature === "number" ? body.temperature : 0.8,
      max_completion_tokens:
        typeof body.max_completion_tokens === "number"
          ? body.max_completion_tokens
          : 300,
      // optional: you can add top_p, frequency_penalty, presence_penalty, etc.
    };

    try {
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await resp.json();

      // If OpenAI returned an error status, forward that message
      if (!resp.ok) {
        const status = resp.status || 500;
        return new Response(JSON.stringify({ error: data }), {
          status,
          headers: corsHeaders,
        });
      }

      // Success: return the OpenAI response body to the client
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (err) {
      // Network / unexpected error
      return new Response(
        JSON.stringify({
          error: "Request to OpenAI failed.",
          details: err.message,
        }),
        {
          status: 502,
          headers: corsHeaders,
        }
      );
    }
  },
};
