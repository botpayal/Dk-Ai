const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ===============================
// HOME / SERVER TEST
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "DK AI Builder",
    message: "DK AI Server is running successfully."
  });
});

app.get("/api/hello", (req, res) => {
  res.json({
    success: true,
    message: "Hello from DK AI!"
  });
});

// ===============================
// GEMINI
// ===============================

async function askGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in Render.");
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
      ],
      generationConfig: {
        temperature: 0.2
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "Gemini API request failed."
    );
  }

  const parts =
    data?.candidates?.[0]?.content?.parts || [];

  const text = parts
    .map((part) => part.text || "")
    .join("");

  if (!text.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

// ===============================
// CLEAN GEMINI JSON
// ===============================

function extractJson(text) {
  let cleaned = text.trim();

  // Remove markdown code fences
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Direct JSON
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Find JSON object
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first !== -1 && last !== -1 && last > first) {
    const possibleJson = cleaned.substring(first, last + 1);

    try {
      return JSON.parse(possibleJson);
    } catch (_) {}
  }

  throw new Error("Gemini returned invalid JSON.");
}

// ===============================
// GENERATE
// ===============================

app.post("/api/generate", async (req, res) => {
  try {
    const prompt = req.body?.prompt;
    const action =
      req.body?.action || "coding_or_explanation";

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Please provide a prompt."
      });
    }

    // ===========================
    // FILE GENERATION
    // ===========================

    if (action === "files") {
      const filePrompt = `
You are DK AI Builder.

The user wants to create a software project.

USER REQUEST:
${prompt}

Create the complete project.

IMPORTANT:

- Generate ALL files required by the project.
- There is NO fixed file limit.
- A small project can have 1-5 files.
- A larger project can have many files.
- Every generated file must contain complete usable code.
- Never create an empty placeholder file.
- Use safe relative filenames only.
- Do not use absolute paths.
- Do not use Markdown code fences.
- Do not add explanations outside the JSON.

Return ONLY valid JSON in exactly this structure:

{
  "projectName": "DK AI Project",
  "summary": "Short project description",
  "files": [
    {
      "name": "index.html",
      "content": "<complete code>"
    },
    {
      "name": "style.css",
      "content": "<complete code>"
    },
    {
      "name": "script.js",
      "content": "<complete code>"
    }
  ]
}

If the project needs a different technology, generate the appropriate files.

Make sure the JSON is valid.
Escape quotation marks and newlines correctly inside file content.
`;

      const raw = await askGemini(filePrompt);

      let result;

      try {
        result = extractJson(raw);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: "Gemini could not generate files correctly.",
          details: error.message
        });
      }

      if (!result || !Array.isArray(result.files)) {
        return res.status(500).json({
          success: false,
          error: "Gemini response does not contain project files."
        });
      }

      const files = [];

      for (const file of result.files) {
        if (
          !file ||
          typeof file.name !== "string" ||
          typeof file.content !== "string"
        ) {
          continue;
        }

        let safeName = file.name
          .replace(/\\/g, "/")
          .split("/")
          .pop();

        safeName = safeName.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        if (!safeName) {
          continue;
        }

        files.push({
          name: safeName,
          content: file.content
        });
      }

      if (files.length === 0) {
        return res.status(500).json({
          success: false,
          error: "No valid project files were generated."
        });
      }

      return res.json({
        success: true,
        type: "files",
        projectName:
          result.projectName || "DK AI Project",
        summary: result.summary || "",
        fileCount: files.length,
        files
      });
    }

    // ===========================
    // NORMAL AI / CODING
    // ===========================

    const codingPrompt = `
You are DK AI Builder.

USER REQUEST:
${prompt}

Help the user build their project.

The user can communicate in Bengali, English, Hindi,
Hinglish, Urdu, or other languages.

If the user asks for coding:

- Give complete usable code.
- Clearly show filenames.
- If multiple files are required, separate them by filename.
- Do not leave important code incomplete.

If the user asks for an explanation:

- Explain clearly.
- Keep the instructions practical.
- Understand the user's language automatically.
`;

    const answer = await askGemini(codingPrompt);

    return res.json({
      success: true,
      type: "ai",
      answer
    });

  } catch (error) {
    console.error("DK AI ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error."
    });
  }
});

// ===============================
// START
// ===============================

app.listen(PORT, () => {
  console.log(
    `DK AI Server running on port ${PORT}`
  );
});
