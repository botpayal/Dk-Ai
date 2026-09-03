const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

// Gemini API key Render Environment Variables থেকে নেবে
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Current Gemini model
const GEMINI_MODEL = "gemini-3.7-flash";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// --------------------------------------------------
// Health check
// --------------------------------------------------
app.get("/health", (req, res) => {
  res.json({
    success: true,
    name: "DK AI Builder",
    message: "DK AI Server is running successfully.",
    model: GEMINI_MODEL,
    apiConfigured: !!GEMINI_API_KEY
  });
});

// --------------------------------------------------
// Main API: POST /api/generate
// --------------------------------------------------
app.post("/api/generate", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured on the server."
      });
    }

    const prompt = req.body?.prompt;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: "Please provide a prompt."
      });
    }

    // Optional action from your HTML app
    const action = req.body?.action || "coding_or_explanation";

    const systemInstruction = `
You are DK AI, a helpful AI assistant and coding expert.

User language can be Bengali, English, Hindi, or mixed language.
Reply naturally in the language used by the user.

You help users:
- plan apps
- write HTML, CSS and JavaScript
- create Node.js backends
- explain coding
- debug errors
- create game/app project structures
- generate multiple project files when requested

When the user asks for coding, provide clean, complete and runnable code.
Do not put unnecessary explanations inside code blocks.

Current requested action: ${action}
`;

    const finalPrompt = `${systemInstruction}

USER REQUEST:
${prompt.trim()}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: finalPrompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(response.status).json({
        success: false,
        error:
          data?.error?.message ||
          "Gemini API request failed.",
        details: data
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "";

    if (!text) {
      return res.status(500).json({
        success: false,
        error: "Gemini returned an empty response."
      });
    }

    return res.json({
      success: true,
      model: GEMINI_MODEL,
      text: text
    });

  } catch (error) {
    console.error("Server Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error."
    });
  }
});

// --------------------------------------------------
// Serve your frontend
// --------------------------------------------------

const PUBLIC_DIR = __dirname;

app.use(express.static(PUBLIC_DIR));

// Render URL খুললে index.html দেখাবে
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// --------------------------------------------------
// 404
// --------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found."
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`DK AI Server running on port ${PORT}`);
  console.log(`Gemini model: ${GEMINI_MODEL}`);
  console.log(`Frontend: /index.html`);
});
