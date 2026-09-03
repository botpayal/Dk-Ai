const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Test
app.get("/", (req, res) => {
  res.send("Hello! DK AI Server is running successfully.");
});

// Gemini AI
async function askGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    GEMINI_MODEL +
    ":generateContent?key=" +
    encodeURIComponent(GEMINI_API_KEY);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : "Gemini API request failed."
    );
  }

  const text =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

// AI generation
app.post("/api/generate", async (req, res) => {
  try {
    const prompt = req.body && req.body.prompt;
    const action =
      (req.body && req.body.action) || "coding_or_explanation";

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Please provide a prompt."
      });
    }

    if (action === "files") {
      const filePrompt = `
You are DK AI Builder.

Create the project requested by the user.

USER REQUEST:
${prompt}

Return ONLY valid JSON using this format:

{
  "projectName": "Project Name",
  "summary": "Short description",
  "files": [
    {
      "name": "index.html",
      "content": "complete code"
    },
    {
      "name": "style.css",
      "content": "complete code"
    },
    {
      "name": "script.js",
      "content": "complete code"
    }
  ]
}

Generate all files required by the project.
Do not use a fixed file count.
Every file must contain complete code.
Do not use markdown code fences.
`;

      const result = await askGemini(filePrompt);

      let parsed;

      try {
        parsed = JSON.parse(result);
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: "Gemini returned invalid JSON.",
          raw: result
        });
      }

      return res.json({
        success: true,
        type: "files",
        projectName: parsed.projectName || "DK AI Project",
        summary: parsed.summary || "",
        files: Array.isArray(parsed.files) ? parsed.files : []
      });
    }

    const codingPrompt = `
You are DK AI Builder.

The user wants help creating an application.

USER REQUEST:
${prompt}

Give a professional answer.
If coding is requested, provide complete usable code.
If multiple files are required, clearly separate them by filename.
Understand the user's language and respond appropriately.
`;

    const answer = await askGemini(codingPrompt);

    return res.json({
      success: true,
      type: "ai",
      answer: answer
    });

  } catch (error) {
    console.error("DK AI ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Server error."
    });
  }
});

app.listen(PORT, () => {
  console.log("DK AI Server running on port " + PORT);
});
