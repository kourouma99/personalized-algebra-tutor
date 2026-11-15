/*
  server.js — serves the page AND the AI route.
  The API key will live here later (never in browser code).
*/
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3000;

const app = express();
app.use(express.json()); // lets us read JSON sent by the browser

// Serve ONLY the frontend files. Never the whole folder, so server code and the future .env stay private.
app.get("/", (req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.use("/css", express.static(path.join(ROOT, "css")));
app.use("/js", express.static(path.join(ROOT, "js")));

// The AI route: fake answer for now
app.post("/api/scenario", (req, res) => {
  const { concept, interest, variant } = req.body;
  res.json({ concept, interest, variant, message: "fake for now" });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));