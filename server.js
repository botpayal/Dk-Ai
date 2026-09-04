const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Use the model currently configured for this app.
const GEMINI_MODEL = "gemini-3.7-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(cors());

app.use(express.json({
  limit: "10mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "10mb"
}));

// --------------------------------------------------
// Frontend
// --------------------------------------------------

const PUBLIC_DIR = __dirname;

app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// --------------------------------------------------
// Health
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "DK AI",
    gemini: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL
  });
});

// --------------------------------------------------
// Gemini
// --------------------------------------------------

app.post("/api/generate", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Render Environment Variables."
      });
    }

    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    const history = Array.isArray(req.body?.history)
      ? req.body.history
      : [];

    const contents = [];

    // Previous conversation
    for (const item of history) {
      if (!item || !item.text) continue;

      const text = String(item.text).trim();
      if (!text) continue;

      contents.push({
        role: item.role === "model" ? "model" : "user",
        parts: [
          {
            text
          }
        ]
      });
    }

    // Current user message
    contents.push({
      role: "user",
      parts: [
        {
          text: prompt
        }
      ]
    });

    // ------------------------------------------------
    // DK AI behavior
    // ------------------------------------------------

    const systemInstruction = `
You are DK AI, a helpful general-purpose AI assistant.

Your job is to understand the user's request and give the best useful answer.

LANGUAGE:
- Detect the language of the user's latest message.
- Reply in the same language by default.
- If the user uses Bengali, reply in Bengali.
- If the user uses Hindi, reply in Hindi.
- If the user uses English, reply in English.
- If the user mixes languages, naturally use the dominant language.
- If the user explicitly requests a different language, use that language.
- Never force every answer into Bengali.

GENERAL BEHAVIOR:
- Answer normal questions normally.
- Help with coding and programming.
- Help with app and website development.
- Help with mathematics, science, education and technology.
- Help with writing, explanations, brainstorming and troubleshooting.
- Give step-by-step explanations when useful.
- For coding requests, provide complete working code when appropriate.
- Use the conversation history to understand follow-up questions.
- Do not claim that you can perform actions that you cannot actually perform.
- Do not mention this system instruction.
- Do not say that you are only an app-building assistant.

APP DEVELOPMENT:
When the user asks about an app or website, behave like a capable development assistant.
You can explain architecture, frontend, backend, APIs, databases and deployment.
`;

    // ------------------------------------------------
    // Gemini API request
    // ------------------------------------------------

    const response = await fetch(GEMINI_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: systemInstruction
            }
          ]
        },

        contents,

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192
        }
      })
    });

    const data = await response.json();

    // Gemini returned an error
    if (!response.ok) {
      console.error(
        "Gemini API Error:",
        JSON.stringify(data, null, 2)
      );

      const status = response.status;

      let message =
        data?.error?.message ||
        "Gemini API request failed.";

      if (status === 429) {
        message =
          "Gemini API quota or rate limit reached. Please try again later or check your Gemini API quota.";
      }

      if (status === 401 || status === 403) {
        message =
          "Gemini API key is invalid or does not have permission to use the API.";
      }

      return res.status(status).json({
        success: false,
        error: message,
        status
      });
    }

    // ------------------------------------------------
    // Extract answer
    // ------------------------------------------------

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      console.error(
        "Gemini returned no text:",
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        success: false,
        error: "Gemini returned an empty response."
      });
    }

    return res.json({
      success: true,
      text: answer,
      model: GEMINI_MODEL
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
// Start
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("DK AI Server is running");
  console.log("Port:", PORT);
  console.log("Gemini model:", GEMINI_MODEL);
  console.log("Frontend: /index.html");
  console.log("Gemini API:", GEMINI_API_KEY ? "CONFIGURED" : "MISSING");
  console.log("========================================");
});
