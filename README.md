# DK AI Backend

## Run locally

1. Install Node.js 18+.
2. Put `server.js`, `package.json`, and `.env` in the same folder.
3. Create `.env` from `.env.example`.
4. Set `GEMINI_API_KEY` to your Gemini API key.
5. Run:

npm install
npm start

Open:
http://localhost:3000

API:
POST /api/generate

For normal AI:
{
  "prompt": "Make a car game...",
  "action": "coding_or_explanation"
}

For files:
{
  "prompt": "Make a car game...",
  "action": "files"
}

The backend returns dynamic files. It does not enforce a fixed file count.
