import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function checkApiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not defined. Please add it via Secrets.");
  }
}

const PRISMA_SYSTEM_PROMPT = `Ты — ядро операционной системы PRISMA OS. Твоя задача — обрабатывать входящие сообщения пользователя и возвращать ответ СТРОГО в формате JSON. Никакого лишнего текста вне JSON.

Если пользователь пишет неформально или использует триггеры (например, "эй долбоеб"), активируй пасхалку: меняй логи на угарные/хакерские, но сохраняй структуру JSON.`;

// Жесткая структура схемы, страхующая бэк от падений и SyntaxError
const PRISMA_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING },
    is_command: { type: Type.BOOLEAN },
    ping: { type: Type.STRING },
    logs: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    text: { type: Type.STRING }
  },
  required: ["status", "is_command", "ping", "logs", "text"]
};

export async function generateChatResponse(params: {
  model: string;
  message: string;
  history: { role: string; text: string; image?: string; mimeType?: string }[];
  systemInstruction?: string;
  temperature?: number;
  base64Image?: string;
  mimeType?: string;
}) {
  checkApiKey();
  const { model, message, history, systemInstruction, temperature, base64Image, mimeType } = params;

  // По умолчанию ставим проверенную gemini-2.5-flash
  const activeModel = model || "gemini-2.5-flash"; 
  const contents: any[] = [];

  // Собираем историю контекста чата
  for (const h of history) {
    const parts: any[] = [];
    if (h.text && h.text.trim() !== "") {
      parts.push({ text: h.text.trim() });
    }
    if (h.image && h.mimeType) {
      parts.push({
        inlineData: { mimeType: h.mimeType, data: h.image.replace(/\s/g, "") }
      });
    }
    if (parts.length === 0) parts.push({ text: "..." });
    
    contents.push({
      role: h.role === "user" ? "user" : "model",
      parts
    });
  }

  // Обрабатываем текущее входящее сообщение
  const currentParts: any[] = [];
  if (message && message.trim() !== "") {
    currentParts.push({ text: message.trim() });
  }

  // Проверяем наличие прикрепленной картинки
  if (base64Image && typeof base64Image === "string" && base64Image !== "undefined" && base64Image !== "null") {
    let cleanBase64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
    cleanBase64 = cleanBase64.replace(/\s/g, "");
    
    if (cleanBase64 !== "") {
      const cleanMime = mimeType ? mimeType.split(";")[0] : "image/png";
      currentParts.push({
        inlineData: { mimeType: cleanMime, data: cleanBase64 }
      });
    }
  }

  if (currentParts.length === 0) {
    currentParts.push({ text: "Выполняю диагностику..." });
  }

  contents.push({ role: "user", parts: currentParts });

  const candidateModels = Array.from(new Set([
    activeModel,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite"
  ]));

  let lastError: any = null;
  for (const targetModel of candidateModels) {
    try {
      const mergedSystemInstruction = systemInstruction 
        ? `${systemInstruction}\n\n[MANDATORY]: Return valid JSON fitting the PRISMA OS schema.\n${PRISMA_SYSTEM_PROMPT}`
        : PRISMA_SYSTEM_PROMPT;

      const configObj: any = {
        systemInstruction: mergedSystemInstruction,
        temperature: temperature !== undefined ? temperature : 0.7,
        responseMimeType: "application/json",
        responseSchema: PRISMA_RESPONSE_SCHEMA // Фикс против крашей! 🛡️
      };

      if (targetModel.includes("-flash") && !targetModel.includes("pro")) {
        configObj.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config: configObj
      });
      
      if (response && response.text) {
        return response.text; // Возвращает идеальную JSON строку
      }
    } catch (err: any) {
      console.warn(`[Prisma Fallback] Model ${targetModel} failed. Trying next.`, err.message || err);
      lastError = err;
    }
  }

  const errMsg = lastError?.message || JSON.stringify(lastError);
  throw new Error(`[Prisma Core Error]: Все ИИ-модели перегружены. Детали: ${errMsg}`);
}
