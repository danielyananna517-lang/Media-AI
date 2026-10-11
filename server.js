const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TelegramBot = require('node-telegram-bot-api');

const app = express();

app.use(cors());
app.use(express.json());

// Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Initialize Gemini AI with standard flash model
let genAI = null;
let model = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY.trim());
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

// Initialize Telegram Bot
let bot = null;
if (TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN.trim(), { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userText = msg.text;

    if (!userText || userText.startsWith('/')) return;

    if (!model) {
      return bot.sendMessage(chatId, "⚠️ AI համակարգը դեռ ակտիվացված չէ։ Ստուգեք GEMINI_API_KEY-ը Render-ում։");
    }

    try {
      await bot.sendChatAction(chatId, 'typing');
      const prompt = `Դու NOVESSA AI օգնականն ես Marketplace-երի (Wildberries, Ozon) համար: Պատասխանիր հստակ, պրոֆեսիոնալ և հայերենով:\n\nՀարց: ${userText}`;
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      bot.sendMessage(chatId, responseText);
    } catch (err) {
      console.error('Telegram AI Error:', err);
      // Send actual error message to help debug directly in Telegram
      const errorDetail = err.message || JSON.stringify(err);
      bot.sendMessage(chatId, `❌ Gemini API Սխալ:\n${errorDetail.slice(0, 300)}`);
    }
  });
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!model) {
      return res.status(500).json({ error: "Gemini API key missing" });
    }

    const systemPrompt = `Դու NOVESSA AI օգնականն ես Marketplace-երի (Wildberries, Ozon) համար: Պատասխանիր հստակ, պրոֆեսիոնալ և հայերենով:\n\nՕգտատեր: ${message}`;
    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();

    res.json({ response: responseText });
  } catch (error) {
    console.error("API Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('NOVESSA AI Backend is running successfully! 🚀');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
