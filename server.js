const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ==================================================
// SERVE FRONTEND
// ==================================================

app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ==================================================
// SERVER TEST
// ==================================================

app.get("/api/hello", (req, res) => {
  res.json({
    success: true,
    message: "Hello from DK AI!",
    server: "DK AI Server",
    status: "online"
  });
});

// ==================================================
// GEMINI AI FUNCTION
// ==================================================

async function askGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured in Render Environment Variables."
    );
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

Users may communicate in:
- Bengali
- English
- Hindi
- Hinglish
- Urdu
- Other languages

Understand the user's language and reply in the same language when practical.

Your main tasks are:

1. Understand app and game ideas.
2. Create complete coding when requested.
3. Explain coding and project structure.
4. Help users build websites, apps and games.
5. Generate complete project files when requested.
6. When multiple files are required, clearly separate them by filename.
7. Never claim that a file was created unless its complete content is actually provided.
8. Make generated code complete and usable.
9. Follow the technology requested by the user when possible.
10. Give practical step-by-step instructions.
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
    const errorMessage =
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : "Gemini API request failed.";

    throw new Error(errorMessage);
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

// ==================================================
// AI GENERATE API
// ==================================================

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

    // ==================================================
    // FILE GENERATION
    // ==================================================

    if (action === "files") {
      const filePrompt = `
You are DK AI Builder.

The user wants a complete software project.

USER REQUEST:
${prompt}

Create the complete project based on the request.

Return ONLY valid JSON.

Use exactly this structure:

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

- Generate every file actually required by the project.
- There is NO fixed file limit.
- A small project may have only a few files.
- A larger project can have many files.
- Every generated file must contain complete usable content.
- Use safe relative filenames.
- Do not use absolute paths.
- Do not include Markdown code fences.
- Do not include text outside the JSON.
- Do not create fake or empty files.
- Keep the project structure logical.
- Make sure files work together.
`;

      const rawResult = await askGemini(filePrompt);

      let result;

      try {
        result = JSON.parse(rawResult);
      } catch (error) {
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

    // ==================================================
    // NORMAL AI ANSWER
    // ==================================================

    const codingPrompt = `
You are DK AI Builder.

USER REQUEST:
${prompt}

Understand exactly what the user wants.

If the user asks for coding:

- Give complete usable code.
- If multiple files are required, clearly separate each file by filename.
- Include all important code.
- Do not leave critical parts as placeholders.

If the user asks for an explanation:

- Explain clearly.
- Give practical step-by-step instructions.
- Keep the explanation easy to follow.

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
      error:
        error.message ||
        "Internal server error."
    });
  }
});

// ==================================================
// 404 API HANDLER
// ==================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found."
  });
});

// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `DK AI Server running on port ${PORT}`
  );
});
