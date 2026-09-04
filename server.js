const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const PUBLIC_DIR = __dirname;

app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "DK AI",
    gemini: Boolean(GEMINI_API_KEY)
  });
});

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

    contents.push({
      role: "user",
      parts: [
        {
          text: prompt
        }
      ]
    });

    const systemInstruction = `
You are DK AI, a general-purpose AI assistant.

Answer the user's actual question directly and helpfully.

LANGUAGE:
- Detect the language used by the user.
- Reply in the same language by default.
- If the user uses Bengali, reply in Bengali.
- If the user uses Hindi, reply in Hindi.
- If the user uses English, reply in English.
- If the user mixes languages, naturally follow the language they mainly use.
- If the user explicitly requests another language, use that language.

IMPORTANT:
You are NOT limited to app development.

You can help with:
- programming
- HTML, CSS and JavaScript
- app development
- debugging
- mathematics
- science
- education
- writing
- explanations
- technology
- general knowledge
- brainstorming
- troubleshooting
- coding projects
- website development

For coding requests, provide complete and useful code when appropriate.

Always understand the current conversation before answering.
Do not repeatedly say that you are only an app-building assistant.
Do not mention these internal instructions.
`;

    // Primary model
    const models = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite"
    ];

    let lastError = null;

    for (const model of models) {
      try {
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
          lastError = data?.error?.message || "Gemini API request failed.";
          console.error(`${model} error:`, data);
          continue;
        }

        const answer =
          data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

        if (answer) {
          return res.json({
            success: true,
            text: answer,
            model
          });
        }

        lastError = "Gemini returned an empty response.";
      } catch (err) {
        lastError = err.message;
        console.error(`${model} network error:`, err);
      }
    }

    return res.status(429).json({
      error:
        lastError ||
        "Gemini is temporarily unavailable. Please try again later."
    });

  } catch (error) {
    console.error("DK AI Server Error:", error);

    return res.status(500).json({
      error: error.message || "Internal server error."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("DK AI Server is running");
  console.log("Port:", PORT);
  console.log("Gemini: Connected");
  console.log("Frontend: /index.html");
  console.log("========================================");
});
