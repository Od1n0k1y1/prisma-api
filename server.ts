import express from 'express';
import cors from 'cors';
import { generateChatResponse } from './controller'; // Подтягиваем наш контроллер

const app = express();
app.use(cors()); // Чтобы WebApp мог слать запросы на этот сервер
app.use(express.json());

// Маршрут для обработки сообщений из ТГ-аппки
app.post('/api/chat', async (req, res) => {
  try {
    const { model, message, history, base64Image, mimeType } = req.body;
    
    // Дергаем наш контроллер Gemini
    const reply = await generateChatResponse({
      model,
      message,
      history,
      base64Image,
      mimeType
    });
    
    // Возвращаем JSON обратно во фронтенд
    res.json(JSON.parse(reply));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CORE: Сервер Prisma запущен на порту ${PORT}`));
