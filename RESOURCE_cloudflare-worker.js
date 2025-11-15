// This is your Cloudflare Worker script. It handles requests and interacts with OpenAI's API.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = env.OPENAI_API_KEY; // Ensure you set this in the Cloudflare Workers dashboard
    const apiUrl = "https://api.openai.com/v1/chat/completions";

    let userInput;

    try {
      // Parse the JSON body of the incoming request
      userInput = await request.json();
    } catch (error) {
      // Return an error if the JSON body is invalid
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate that the 'messages' field exists and is an array
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
      max_tokens: 300, // Corrected the parameter name to 'max_tokens'
    };

    try {
      // Send the request to OpenAI's API
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Ensure the response is valid JSON
      const data = await response.json();

      // Validate the OpenAI API response structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        return new Response(
          JSON.stringify({ error: "Unexpected response from OpenAI API" }),
          { status: 502, headers: corsHeaders }
        );
      }

      // Extract the content of the first message in the response
      const messageContent = data.choices[0].message.content;

      // Return the extracted message content as the response
      return new Response(JSON.stringify({ content: messageContent }), {
        headers: corsHeaders,
      });
    } catch (error) {
      // Handle network or API errors
      return new Response(
        JSON.stringify({
          error: "Failed to fetch from OpenAI API",
          details: error.message,
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
