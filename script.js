/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Initial L'Oréal assistant greeting (styled as an ai bubble)
chatWindow.innerHTML = `<div class="msg ai"><div class="section">👋 Bonjour — I'm your L’Oréal Smart Product Advisor. Tell me about your skin, hair, or makeup goal and I’ll suggest products and a routine.</div></div>`;

// Helper to append messages and keep scroll at bottom
function appendMessage(role, htmlContent) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role}`;
  wrapper.innerHTML = htmlContent;
  chatWindow.appendChild(wrapper);

  // Trigger CSS entrance animation:
  // force reflow then add classes so animation runs predictably
  // (keeps beginner-friendly approach using only DOM APIs)
  // Add 'animate-in' + direction based on role
  wrapper.getBoundingClientRect();
  wrapper.classList.add(
    "animate-in",
    role === "user" ? "slide-right" : "slide-left"
  );

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Allow Enter to send (and Shift+Enter to allow multi-line if you switch to textarea later)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (typeof chatForm.requestSubmit === "function") {
      chatForm.requestSubmit();
    } else {
      chatForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  }
});

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = userInput.value.trim();
  if (!userText) return;

  // Show the user's message (right-aligned)
  appendMessage("user", `${escapeHtml(userText)}`);
  userInput.value = "";

  // Ensure the global API key exists (secrets.js provides OPENAI_API_KEY)
  if (
    typeof OPENAI_API_KEY === "undefined" ||
    !OPENAI_API_KEY ||
    OPENAI_API_KEY.startsWith("sk-your")
  ) {
    appendMessage(
      "ai",
      `<div class="section">⚠️ OPENAI_API_KEY not set. Add your key to <code>secrets.js</code> and do NOT commit it to a public repo.</div>`
    );
    return;
  }

  // Add typing indicator (animated dots)
  const typingEl = document.createElement("div");
  typingEl.className = "msg ai typing";
  typingEl.innerHTML = `<div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chatWindow.appendChild(typingEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    // Build messages array for the API; system message sets the L'Oréal persona and scope
    const messages = [
      {
        role: "system",
        content:
          "You are L’Oréal's friendly creative assistant. Help users shape requests about skincare, haircare, and makeup into structured, actionable routines and product suggestions. Offer L’Oréal product and creator recommendations when relevant. If the user's request is unclear, ask 1–2 short clarifying questions. If the request is outside L’Oréal-related topics, politely state you only assist with L’Oréal products and information.",
      },
      { role: "user", content: userText },
    ];

    // If you deploy a Cloudflare Worker, set its URL here so the client posts to the worker.
    const CLOUD_WORKER_URL = "https://lorealchatbot.jalopezo.workers.dev/";

    let res;
    if (CLOUD_WORKER_URL) {
      // Send messages array to your worker; worker should forward to OpenAI using its secret key
      res = await fetch(CLOUD_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          temperature: 0.8,
          max_completion_tokens: 300,
        }),
      });
    } else {
      // Fallback: call OpenAI directly (requires OPENAI_API_KEY in secrets.js)
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: messages,
          temperature: 0.8,
          max_completion_tokens: 300,
        }),
      });
    }

    const data = await res.json();

    // Handle non-OK responses from worker or OpenAI
    if (!res.ok) {
      typingEl.remove();
      const errMsg = data?.error?.message || JSON.stringify(data);
      appendMessage(
        "ai",
        `<div class="section">Error: ${escapeHtml(errMsg)}</div>`
      );
      return;
    }

    // Remove typing indicator
    typingEl.remove();

    // Extract assistant text (data.choices[0].message.content)
    const assistantText =
      data?.choices?.[0]?.message?.content ?? "Sorry, I didn't get a reply.";

    // Format assistant reply into sections split by double newlines.
    // This makes responses appear with line breaks between sections (script, tone, CTA, etc.).
    const parts = assistantText
      .split(/\n\s*\n/)
      .map((p) => `<div class="section">${escapeHtml(p)}</div>`)
      .join("");

    appendMessage("ai", parts);
  } catch (err) {
    // Remove typing indicator and show error
    typingEl.remove();
    appendMessage(
      "ai",
      `<div class="section">Error: ${escapeHtml(
        err.message || "Request failed"
      )}</div>`
    );
  }
});

/* Utility: simple HTML escaping to avoid injecting raw HTML from model/user */
function escapeHtml(unsafe) {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
