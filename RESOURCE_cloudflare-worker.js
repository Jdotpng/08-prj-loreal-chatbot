// This is your Cloudflare Worker script. It handles requests and interacts with OpenAI's API.

addEventListener("fetch", async (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiUrl = "https://api.openai.com/v1/chat/completions";
  const apiKey = "your-openai-api-key"; // Replace with your actual API key

  let userInput;
  try {
    userInput = await request.json();
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!userInput.messages || !Array.isArray(userInput.messages)) {
    return new Response(
      JSON.stringify({
        error: "'messages' field is required and must be an array",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  const requestBody = {
    model: "gpt-4o",
    messages: userInput.messages,
    max_tokens: 300,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return new Response(
        JSON.stringify({ error: "Unexpected response from OpenAI API" }),
        { status: 502, headers: corsHeaders }
      );
    }

    const messageContent = data.choices[0].message.content;

    return new Response(JSON.stringify({ content: messageContent }), {
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch from OpenAI API",
        details: error.message,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
