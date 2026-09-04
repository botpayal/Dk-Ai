// server.js
// DK AI Backend
// Serves index.html and connects /api/generate to Gemini API

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Stable Gemini model.
// Can be changed from Render Environment Variables if needed.
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash";

const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ----------------------------------------------------
// Middleware
// ----------------------------------------------------

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(
  express.json({
    limit: "20mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb",
  })
);

// ----------------------------------------------------
// Static frontend
// ----------------------------------------------------

app.use(express.static(path.join(__dirname, "public")));

// ----------------------------------------------------
// Health check
// ----------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "DK AI",
    gemini: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
  });
});

// ----------------------------------------------------
// Gemini API
// ----------------------------------------------------

app.post("/api/generate", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is not configured on the server."
      });
    }

    const body = req.body || {};

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    // Accept several common history formats.
    const history =
      Array.isArray(body.history)
        ? body.history
        : Array.isArray(body.messages)
        ? body.messages
        : [];

    // ------------------------------------------------
    // System instruction
    // ------------------------------------------------

    const systemInstruction = `
You are DK AI, a general-purpose AI assistant.

Your job is to help users with:
- General questions
- Education and explanations
- Programming and coding
- HTML, CSS, JavaScript and web development
- App ideas and development
- Debugging
- Writing and rewriting
- Mathematics
- Science
- Technology
- Business and productivity
- Creative brainstorming
- Step-by-step instructions
- Multilingual conversation

LANGUAGE RULE:
Always detect the language used by the user.
Reply in the same language as the user's latest message unless the user explicitly asks for another language.

Examples:
- Bengali user -> Bengali reply
- English user -> English reply
- Hindi user -> Hindi reply
- Urdu user -> Urdu reply
- Mixed Bengali/English -> naturally use the same mixed style when appropriate.

Do not automatically translate the user's message into English.

CONVERSATION:
Use the previous conversation context when it is provided.
Remember what the user is currently asking and answer the latest question directly.

STYLE:
Be helpful, natural and conversational.
Do not repeatedly say that you are an AI.
For coding requests, provide working code and explain where it should be placed.
For troubleshooting, identify the likely problem and give practical steps.
If the user asks for a complete file, provide a complete ready-to-use file.
Do not unnecessarily change unrelated parts of the user's project.

APP BUILDER MODE:
When the user describes an app or website they want to build, understand the requirements first and then provide:
1. What needs to be built
2. The required files
3. Working code
4. Setup instructions
5. Testing instructions

Keep the response focused on the user's request.
`;

    // ------------------------------------------------
    // Build Gemini contents
    // ------------------------------------------------

    const contents = [];

    // Previous conversation
    for (const item of history) {
      if (!item) continue;

      let role = item.role;
      let text = "";

      if (typeof item.content === "string") {
        text = item.content;
      } else if (typeof item.text === "string") {
        text = item.text;
      } else if (typeof item.message === "string") {
        text = item.message;
      }

      if (!text.trim()) continue;

      // Gemini accepts user/model roles.
      if (role !== "user" && role !== "model") {
        role = "user";
      }

      contents.push({
        role,
        parts: [
          {
            text: text.trim()
          }
        ]
      });
    }

    // Latest user message
    contents.push({
      role: "user",
      parts: [
        {
          text: prompt
        }
      ]
    });

    // ------------------------------------------------
    // Gemini request
    // ------------------------------------------------

    const geminiResponse = await fetch(GEMINI_API_URL, {
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
          topP: 0.95,
          maxOutputTokens: 8192
        }
      })
    });

    const data = await geminiResponse.json();

    // ------------------------------------------------
    // Gemini error
    // ------------------------------------------------

    if (!geminiResponse.ok) {
      console.error(
        "Gemini API Error:",
        JSON.stringify(data, null, 2)
      );

      const message =
        data?.error?.message ||
        "Gemini API request failed.";

      return res.status(geminiResponse.status).json({
        error: message
      });
    }

    // ------------------------------------------------
    // Extract response text
    // ------------------------------------------------

    let answer = "";

    if (Array.isArray(data?.candidates)) {
      for (const candidate of data.candidates) {
        const parts = candidate?.content?.parts;

        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (typeof part?.text === "string") {
              answer += part.text;
            }
          }
        }
      }
    }

    answer = answer.trim();

    if (!answer) {
      return res.status(502).json({
        error:
          "Gemini returned an empty response."
      });
    }

    // ------------------------------------------------
    // Return response to your HTML app
    // ------------------------------------------------

    return res.json({
      success: true,
      text: answer,
      response: answer,
      model: GEMINI_MODEL
    });

  } catch (error) {
    console.error("DK AI Server Error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Internal server error."
    });
  }
});

// ----------------------------------------------------
// Fallback: open index.html
// ----------------------------------------------------

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// ----------------------------------------------------
// Start server
// ----------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `DK AI Server running on port ${PORT}`
  );

  console.log(
    `Gemini model: ${GEMINI_MODEL}`
  );

  console.log(
    `Gemini API key configured: ${Boolean(GEMINI_API_KEY)}`
  );
});
