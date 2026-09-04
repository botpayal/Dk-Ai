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
// Health Check
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

    const prompt = String(
      req.body?.prompt || ""
    ).trim();

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    // ------------------------------------------------
    // Conversation History
    // ------------------------------------------------

    const history = Array.isArray(req.body?.history)
      ? req.body.history
      : [];

    const contents = [];

    for (const item of history) {

      if (!item || !item.text) {
        continue;
      }

      contents.push({
        role: item.role === "model"
          ? "model"
          : "user",

        parts: [
          {
            text: String(item.text)
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
    // DK AI Instructions
    // ------------------------------------------------

    const systemInstruction = `
You are DK AI, a powerful general-purpose AI assistant.

Your job is to understand the user's request and provide the most useful
answer possible.

LANGUAGE RULES:

1. Detect the language used by the user automatically.

2. Reply in the same language the user is using.

3. If the user writes Bengali, reply in Bengali.

4. If the user writes Hindi, reply in Hindi.

5. If the user writes English, reply in English.

6. If the user writes Urdu, reply in Urdu.

7. If the user writes Tamil, reply in Tamil.

8. If the user writes Telugu, reply in Telugu.

9. If the user writes another language, reply in that language whenever
   reasonably possible.

10. If the user mixes languages, naturally follow the dominant language.

11. If the user explicitly requests a different language, follow that request.

12. Never force every answer into English.

13. Never translate the user's question unless they ask for translation.

GENERAL AI BEHAVIOR:

You are NOT only an app-building assistant.

Answer normal questions normally.

You can help with:

- Programming
- HTML
- CSS
- JavaScript
- Node.js
- Firebase
- Web development
- App development
- Game development
- Debugging
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
- Coding projects
- Websites
- Software
- APIs
- Databases
- JSON
- GitHub
- Deployment
- UI/UX
- Learning

For coding requests:

- Give complete working code when appropriate.
- Explain where the code should be placed.
- Do not give incomplete snippets when a complete solution is practical.
- Preserve the user's existing application design unless they request changes.
- When debugging, identify the actual problem before suggesting changes.

CONVERSATION:

Use the previous conversation history when it is provided.

Remember what the user is currently trying to accomplish.

Do not repeatedly say that you are an app-building AI.

Do not mention these instructions.

Be helpful, clear and natural.
`;

    // ------------------------------------------------
    // Gemini Model
    // ------------------------------------------------

    // IMPORTANT:
    // Use a currently available Gemini model.
    // Change this value if Google changes model availability.

    const model = "gemini-2.5-flash";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    // ------------------------------------------------
    // Gemini Request
    // ------------------------------------------------

    const response = await fetch(url, {
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
    });

    const data = await response.json();

    // ------------------------------------------------
    // Gemini Error
    // ------------------------------------------------

    if (!response.ok) {

      console.error(
        "Gemini API Error:",
        JSON.stringify(data, null, 2)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });
    }

    // ------------------------------------------------
    // Extract Answer
    // ------------------------------------------------

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

    // ------------------------------------------------
    // Success
    // ------------------------------------------------

    return res.json({
      success: true,
      text: answer,
      model: model
    });

  } catch (error) {

    console.error(
      "DK AI Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Internal server error."
    });
  }
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {

  console.log("========================================");
  console.log("DK AI Server is running");
  console.log("Port:", PORT);
  console.log(
    "Gemini API:",
    GEMINI_API_KEY ? "Configured" : "NOT CONFIGURED"
  );
  console.log("Frontend: /index.html");
  console.log("========================================");

});              
