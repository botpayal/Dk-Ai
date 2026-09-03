const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// ===============================
// SERVER TEST
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
// GEMINI API
// ===============================

async function askGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
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
      systemInstruction: {
        parts: [
          {
            text: `
You are DK AI Builder.

You are an AI assistant specialized in helping users build software.

Users may write in Bengali, English, Hindi, Hinglish, Urdu, or other languages.

Your main tasks are:

1. Understand an app or game idea.
2. Create coding for the requested project.
3. Explain the project and its structure.
4. Generate complete project files when requested.
5. Create as many files as the project actually needs.
6. Never force a fixed number of files.
7. When generating code, make it complete and usable.
8. Clearly identify every generated filename.
9. Do not claim a file was generated unless its content is actually included.
10. Follow the user's requested technology when possible.
`
          }
        ]
      },
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
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : "Gemini API request failed."
    );
  }

  let text = "";

  if (
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts
  ) {
    for (const part of data.candidates[0].content.parts) {
      if (part.text) {
        text += part.text;
      }
    }
  }

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

// ===============================
// AI CODING / EXPLANATION
// ===============================

app.post("/api/generate", async (req, res) => {
  try {
    const prompt = req.body?.prompt;
    const action = req.body?.action || "coding_or_explanation";

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

The user wants a software project.

USER REQUEST:
${prompt}

Create the complete project based on the request.

Return ONLY valid JSON.

Required format:

{
  "projectName": "Project Name",
  "summary": "Short project description",
  "files": [
    {
      "name": "index.html",
      "content": "complete code here"
    },
    {
      "name": "style.css",
      "content": "complete code here"
    },
    {
      "name": "script.js",
      "content": "complete code here"
    }
  ]
}

IMPORTANT RULES:

- Generate every file required by the project.
- There is NO fixed file limit.
- A simple project may have 3 files.
- A larger project may have 10, 20, or more files.
- Every file must contain complete usable content.
- Use safe relative filenames.
- Do not include Markdown code fences.
- Do not include text outside the JSON.
- Do not make up empty files.
- Make the project structure logical.
`;

      const rawResult = await askGemini(filePrompt);

      let result;

      try {
        result = JSON.parse(rawResult);
      } catch (error) {
        // Gemini sometimes returns JSON inside extra text.
        const firstBrace = rawResult.indexOf("{");
        const lastBrace = rawResult.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1) {
          const extracted = rawResult.substring(
            firstBrace,
            lastBrace + 1
          );

          try {
            result = JSON.parse(extracted);
          } catch (e) {
            return res.status(500).json({
              success: false,
              error: "Gemini returned invalid file JSON.",
              raw: rawResult
            });
          }
        } else {
          return res.status(500).json({
            success: false,
            error: "Gemini returned an invalid file response.",
            raw: rawResult
          });
        }
      }

      if (!Array.isArray(result.files)) {
        return res.status(500).json({
          success: false,
          error: "No project files were generated."
        });
      }

      const files = result.files
        .filter(
          (file) =>
            file &&
            typeof file.name === "string" &&
            typeof file.content === "string"
        )
        .map((file) => {
          let safeName = file.name
            .replace(/\\/g, "/")
            .split("/")
            .pop();

          safeName = safeName.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

          if (!safeName) {
            safeName = "generated_file.txt";
          }

          return {
            name: safeName,
            content: file.content
          };
        });

      return res.json({
        success: true,
        type: "files",
        projectName:
          result.projectName || "DK AI Project",
        summary:
          result.summary || "",
        fileCount: files.length,
        files
      });
    }

    // ===========================
    // NORMAL CODING / ANSWER
    // ===========================

    const codingPrompt = `
You are DK AI Builder.

USER REQUEST:
${prompt}

Understand exactly what the user wants.

If the user asks for coding:
- Give complete usable code.
- If multiple files are needed, separate them clearly by filename.
- Include all important code.

If the user asks for an explanation:
Explain the project clearly and professionally.

The user may use Bengali, English, Hindi, Hinglish, Urdu, or another language.
Understand the request regardless of language.
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
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(
    "DK AI Server running on port " + PORT
  );
});
GitHub-এ করার পর
