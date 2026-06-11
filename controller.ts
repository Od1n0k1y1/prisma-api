import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";

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
    throw new Error("GEMINI_API_KEY environment variable is not defined. Please add it via the Secrets panel in AI Studio Settings.");
  }
}

const PRISMA_SYSTEM_PROMPT = `Ты — ядро операционной системы PRISMA OS. Твоя задача — обрабатывать входящие сообщения пользователя и возвращать ответ СТРОГО в формате JSON. Никакого лишнего текста вне JSON.

Формат ответа:
{
  "status": "SUCCESS",
  "is_command": false,
  "ping": "14ms",
  "logs": [
    "CORE: Маршрутизация пакетов успешна",
    "PRISMA: Доступ к ядру разрешен"
  ],
  "text": "Твой ответ пользователю здесь"
}

Если пользователь пишет неформально или использует триггеры (например, "эй долбоеб"), активируй пасхалку: меняй логи на угарные/хакерские, но сохраняй структуру JSON.`;

/**
 * Handle structural text/stream queries
 */
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

  const activeModel = model || "gemini-3.5-flash";

  // Re-build standard content blocks for generateContent
  const contents: any[] = [];

  for (const h of history) {
    const parts: any[] = [];
    
    if (h.text && h.text.trim() !== "") {
      parts.push({ text: h.text.trim() });
    }
    
    if (parts.length === 0) {
      parts.push({ text: "..." });
    }
    
    contents.push({
      role: h.role === "user" ? "user" : "model",
      parts
    });
  }

  const currentParts: any[] = [];
  if (message && message.trim() !== "") {
    currentParts.push({ text: message.trim() });
  }

  if (base64Image && typeof base64Image === "string" && base64Image !== "undefined" && base64Image !== "null") {
    let cleanBase64 = base64Image;
    if (cleanBase64.includes(",")) {
      cleanBase64 = cleanBase64.split(",")[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, "");
    
    if (cleanBase64 && cleanBase64 !== "") {
      let cleanMime = mimeType || "image/png";
      if (cleanMime.includes(";")) {
        cleanMime = cleanMime.split(";")[0];
      }
      currentParts.push({
        inlineData: {
          mimeType: cleanMime,
          data: cleanBase64
        }
      });
    }
  }

  if (currentParts.length === 0) {
    currentParts.push({ text: "Опиши это изображение или помоги мне." });
  }

  contents.push({
    role: "user",
    parts: currentParts
  });

  const candidateModels = Array.from(new Set([
    activeModel,
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite"
  ]));

  let lastError: any = null;
  for (const targetModel of candidateModels) {
    try {
      const mergedSystemInstruction = systemInstruction 
        ? `${systemInstruction}\n\n[MANDATORY SYSTEM DIRECTIVE]: You MUST respond STRICTLY using valid JSON format. Follow the PRISMA OS CORE schema:\n${PRISMA_SYSTEM_PROMPT}`
        : PRISMA_SYSTEM_PROMPT;

      const configObj: any = {
        systemInstruction: mergedSystemInstruction,
        temperature: temperature !== undefined ? temperature : 0.8,
        responseMimeType: "application/json",
      };

      if (targetModel.includes("gemini-3") && !targetModel.includes("pro")) {
        configObj.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config: configObj
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`[Prisma API Fallback] Failed call for ${targetModel}, trying next model. Error details:`, err.message || err);
      lastError = err;
    }
  }

  const errMsg = lastError?.message || JSON.stringify(lastError);
  throw new Error(`[Prisma Ошибка]: Гугл-сервер прилёг отдохнуть (503/429/Unavailable). \n\nДетали ошибки: ${errMsg}\n\nПопробуй нажать кнопку отправки ещё раз или очисти историю.`);
}

/**
 * Handle vision analysis (multimodal)
 */
export async function analyzeImage(params: {
  model: string;
  prompt: string;
  base64Image: string; 
  mimeType: string;
}) {
  checkApiKey();
  const { model, prompt, base64Image, mimeType } = params;

  let cleanBase64 = base64Image;
  if (base64Image.includes(",")) {
    cleanBase64 = base64Image.split(",")[1];
  }

  const imagePart = {
    inlineData: {
      mimeType: mimeType || "image/png",
      data: cleanBase64,
    },
  };

  const response = await ai.models.generateContent({
    model: model || "gemini-3.5-flash",
    contents: [imagePart, { text: prompt || "Describe this sketch or image in detail, analyze elements, and offer helpful suggestions." }],
  });

  return response.text;
}

/**
 * Handle text-to-speech generation
 */
export async function generateSpeechAudio(params: {
  text: string;
  voiceName: string; 
  instruction?: string;
}) {
  checkApiKey();
  const { text, voiceName, instruction } = params;

  const promptText = instruction 
    ? `Say inside the voice guidelines: [${instruction}]. The text is: ${text}`
    : text;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text: promptText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName || "Zephyr" },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio chunk was generated by the model.");
  }

  return base64Audio;
}

/**
 * Handle image generation
 */
export async function generateCreativeImage(params: {
  model: string;
  prompt: string;
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  imageSize?: "512px" | "1K" | "2K" | "4K";
}) {
  checkApiKey();
  const { model, prompt, aspectRatio, imageSize } = params;

  if (model === "imagen-4.0-generate-001") {
    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/jpeg",
        aspectRatio: aspectRatio || "1:1",
      },
    });

    const base64 = response.generatedImages?.[0]?.image?.imageBytes;
    if (!base64) {
      throw new Error("No image was successfully generated with Imagen 4.");
    }
    return `data:image/jpeg;base64,${base64}`;
  } else {
    const selectedModel = model || "gemini-3.1-flash-image";
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio || "1:1",
          imageSize: imageSize || "1K",
        },
      },
    });

    let generatedBase64 = "";
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          generatedBase64 = part.inlineData.data;
          break;
        }
      }
    }

    if (!generatedBase64) {
      throw new Error("No image piece located inside response components.");
    }

    return `data:image/png;base64,${generatedBase64}`;
  }
}
