import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));

const getGeminiService = async () => {
  return await import("./src/server/gemini-service.js");
};

// API Router
app.get("/api/gemini/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "ok", keySet: !!process.env.GEMINI_API_KEY });
});

app.get("/api/gemini/ping", async (req: express.Request, res: express.Response) => {
  try {
    const service = await getGeminiService();
    const text = await service.generateChatResponse({
      model: "gemini-3.1-flash-lite",
      message: "ping",
      history: [],
      systemInstruction: "reply 'ok'"
    });
    res.json({ status: "ok", test: text });
  } catch (error: any) {
    res.status(500).json({ status: "error", error: error.message || error });
  }
});

app.post("/api/gemini/chat", async (req: express.Request, res: express.Response) => {
  try {
    const service = await getGeminiService();
    const text = await service.generateChatResponse(req.body);
    res.json({ text });
  } catch (error: any) {
    console.error("Express Chat API error:", error);
    res.status(500).json({ error: error.message || "Generic Server Error" });
  }
});

app.post("/api/gemini/vision", async (req: express.Request, res: express.Response) => {
  try {
    const service = await getGeminiService();
    const text = await service.analyzeImage(req.body);
    res.json({ text });
  } catch (error: any) {
    console.error("Express Vision API error:", error);
    res.status(500).json({ error: error.message || "Generic Server Error" });
  }
});

app.post("/api/gemini/tts", async (req: express.Request, res: express.Response) => {
  try {
    const service = await getGeminiService();
    const base64Audio = await service.generateSpeechAudio(req.body);
    res.json({ base64Audio });
  } catch (error: any) {
    console.error("Express TTS API error:", error);
    res.status(500).json({ error: error.message || "Generic Server Error" });
  }
});

app.post("/api/gemini/image", async (req: express.Request, res: express.Response) => {
  try {
    const service = await getGeminiService();
    const imageUrl = await service.generateCreativeImage(req.body);
    res.json({ imageUrl });
  } catch (error: any) {
    console.error("Express Image API error:", error);
    res.status(500).json({ error: error.message || "Generic Server Error" });
  }
});

// Serve dynamic packaged core file
app.get("/prisma_os_core.html", (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, "prisma_os_core.html"));
});

// Serve static assets in production
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// Fallback for Single Page Application routing
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server started successfully on port ${port}`);
});
