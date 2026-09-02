const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return new GoogleGenAI({
    apiKey: apiKey
  });
}


// ===============================
// HEALTH CHECK
// ===============================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "DK AI",
    model: MODEL
  });
});


// ===============================
// CHAT API
// ===============================

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const ai = getAI();

    const response = await ai.models.generateContent({
      model: MODEL,

      contents: [
        {
          role: "user",

          parts: [
            {
              text:
                `You are DK AI, a helpful multilingual AI assistant.

Understand the user's language and reply in the same language unless the user asks for another language.

Be clear, friendly, useful and accurate.

User:
${message}`
            }
          ]
        }
      ]
    });

    res.json({
      reply: response.text || "I couldn't generate a response."
    });

  } catch (error) {

    console.error("Chat error:", error);

    res.status(500).json({
      error: "DK AI could not process the request.",

      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
});


// ===============================
// FILE / IMAGE ANALYSIS API
// ===============================

app.post(
  "/api/analyze-file",
  upload.single("file"),

  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded."
        });
      }

      const ai = getAI();

      const base64Data =
        req.file.buffer.toString("base64");

      const mimeType =
        req.file.mimetype ||
        "application/octet-stream";

      const response =
        await ai.models.generateContent({

          model: MODEL,

          contents: [
            {
              role: "user",

              parts: [

                {
                  text:
                    `Analyze the uploaded file.

If it is an image, describe the important visible content.

If it is a document, summarize the useful information.

If it is another supported media file, explain what you can understand from it.

Answer clearly in the user's language when possible.`
                },

                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                }

              ]
            }
          ]
        });

      res.json({

        fileName:
          req.file.originalname,

        mimeType: mimeType,

        reply:
          response.text ||
          "I couldn't analyze this file."

      });

    } catch (error) {

      console.error(
        "File analysis error:",
        error
      );

      res.status(500).json({

        error:
          "File analysis failed.",

        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined
      });
    }
  }
);


// ===============================
// OPEN DK AI APP
// ===============================

app.get("*", (req, res) => {

  res.sendFile(
    path.join(
      publicDir,
      "index.html"
    )
  );

});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

  console.log(
    `DK AI server running on port ${PORT}`
  );

});
