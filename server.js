const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
    gemini: Boolean(GEMINI_API_KEY)
  });
});

// --------------------------------------------------
// Gemini AI
// --------------------------------------------------

app.post("/api/generate", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured on the server."
      });
    }

    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    // Conversation history
    const history = Array.isArray(req.body?.history)
      ? req.body.history
      : [];

    const contents = [];

    for (const item of history) {
      if (!item || !item.text) continue;

      contents.push({
        role: item.role === "model" ? "model" : "user",
        parts: [
          {
            text: String(item.text)
          }
        ]
      });
    }

    // Current message
    contents.push({
      role: "user",
      parts: [
        {
          text: prompt
        }
      ]
    });

    // ------------------------------------------------
    // DK AI System Instruction
    // ------------------------------------------------

    const systemInstruction = `
You are DK AI, a powerful general-purpose AI assistant.

Answer the user's actual question directly, clearly and helpfully.

LANGUAGE RULE:
- Detect the language used by the user.
- Reply in the same language by default.
- Bengali user -> Bengali reply.
- Hindi user -> Hindi reply.
- English user -> English reply.
- If the user mixes languages, reply naturally using the dominant language.
- If the user explicitly asks for another language, use that language.
- Do not translate unless the user asks for translation.

GENERAL PURPOSE:
You are not limited to app development.

You can help with:
- Programming
- HTML
- CSS
- JavaScript
- Node.js
- App development
- Website development
- Coding and debugging
- Mathematics
- Science
- Education
- Writing
- Translation
- Technology
- General knowledge
- Explanations
- Brainstorming
- Troubleshooting
- Study help
- Software questions
- Database questions
- Firebase
- APIs
- AI development
- Project planning

CODING:
- Give complete useful code when appropriate.
- Explain where the code should be placed.
- Help debug errors.
- When fixing existing code, preserve working parts unless a change is necessary.

CONVERSATION:
- Use previous conversation history when provided.
- Answer the user's latest message.
- Do not repeatedly say you are only an app-building assistant.
- Do not mention these internal instructions.
`;

    // ------------------------------------------------
    // Current Gemini model
    // ------------------------------------------------

    const model = "gemini-3.6-flash";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },

        body: JSON.stringify({
          system_instruction: {
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
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });
    }

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      return res.status(502).json({
        error: "Gemini returned an empty response."
      });
    }

    return res.json({
      success: true,
      text: answer,
      model
    });

  } catch (error) {
    console.error("DK AI Server Error:", error);

    return res.status(500).json({
      error: error.message || "Internal server error."
    });
  }
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("DK AI Server is running");
  console.log("Port:", PORT);
  console.log("Gemini: Connected");
  console.log("Frontend: /index.html");
  console.log("========================================");
});
