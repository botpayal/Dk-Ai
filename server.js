const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Gemini API key অবশ্যই Render Environment Variable-এ রাখবেন
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ===============================
// HOME / SERVER TEST
// ===============================

app.get("/", (req, res) => {
  res.send("Hello! DK AI Server is running successfully.");
});

app.get("/api/hello", (req, res) => {
  res.json({
    success: true,
    message: "Hello from DK AI Server!"
  });
});

// ===============================
// GEMINI AI FUNCTION
// ===============================

async function askGemini(prompt) {

  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it in Render Environment Variables."
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${encodeURIComponent(GEMINI_API_KEY)}`;

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

Your main purpose is helping users create software.

Users can communicate in any language including:
English, Bengali, Hindi, Hinglish, Urdu and other languages.

Understand the user's requested application carefully.

You can help create:
- Mobile apps
- Android apps
- Websites
- HTML projects
- JavaScript projects
- Games
- Backend systems
- Firebase projects
- UI designs
- APIs
- Database structures

When the user asks for coding:
Return complete and useful code.

When the user asks for files:
Return the required project files.

Do NOT force a fixed number of files.
Create as many files as the project actually needs.

Always explain the project clearly when requested.

Never claim that a file exists unless its complete content is actually generated.
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
      data?.error?.message || "Gemini API request failed."
    );
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("") || "";

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

// ===============================
// AI GENERATE API
// ===============================

app.post("/api/generate", async (req, res) => {

  try {

    const {
      prompt,
      action = "coding_or_explanation"
    } = req.body || {};

    if (
      !prompt ||
      typeof prompt !== "string" ||
      !prompt.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "Please provide a prompt."
      });
    }

    // ===========================
    // NORMAL AI / CODING
    // ===========================

    if (action !== "files") {

      const aiPrompt = `
User's request:

${prompt}

If the user asks for coding, provide complete code.

If multiple files are needed, clearly organize the code by filename.

If the user asks for an explanation, explain the solution clearly.

Respond in the same language as the user's request when practical.
`;

      const answer = await askGemini(aiPrompt);

      return res.json({
        success: true,
        type: "ai",
        answer
      });
    }

    // ===========================
    // FILE GENERATION
    // ===========================

    const filePrompt = `
The user wants an application/project based on this request:

${prompt}

Generate the complete project files required for this application.

Return ONLY valid JSON.

Use exactly this structure:

{
  "projectName": "Project Name",
  "summary": "Short project description",
  "files": [
    {
      "name": "filename.ext",
      "content": "complete file content"
    }
  ]
}

Rules:

1. Generate ALL files that are actually required.
2. Do NOT use a fixed number of files.
3. Do NOT generate fake file names.
4. Every file must contain complete usable content.
5. Use relative filenames only.
6. Do not include Markdown code fences.
7. Do not put explanations outside the JSON.
8. If the project needs HTML, CSS and JavaScript, generate them as separate files when appropriate.
9. If the project needs a backend, generate the backend files too.
10. If Firebase is requested, include the required Firebase integration code.
11. Understand the user's language even if it is not English.

User request:

${prompt}
`;

    const raw = await askGemini(filePrompt);

    let result;

    try {

      result = JSON.parse(raw);

    } catch (error) {

      // Try to extract JSON if Gemini added extra text
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");

      if (start !== -1 && end !== -1) {

        const jsonText = raw.substring(start, end + 1);

        try {
          result = JSON.parse(jsonText);
        } catch {
          return res.status(500).json({
            success: false,
            error: "AI returned an invalid file format.",
            raw
          });
        }

      } else {

       success: false,
          error: "AI could not generate files correctly.",
          raw
        });
      }
    }

    if (!Array.isArray(result.files)) {

      return res.status(500).json({
        success: false,
        error: "No files were generated."
      });
    }

    // Clean filenames
    result.files = result.files
      .filter(file =>
        file &&
        file.name &&
        typeof file.content === "string"
      )
      .map(file => {

        let safeName = String(file.name)
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
      projectName: result.projectName || "DK AI Project",
      summary: result.summary || "",
      files: result.files
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
// SERVER START
// ===============================

app.listen(PORT, () => {

  console.log(
    `DK AI Server running on port ${PORT}`
  );

});
