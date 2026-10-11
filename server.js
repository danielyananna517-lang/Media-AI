const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TelegramBot = require('node-telegram-bot-api');

const app = express();

// Allow CORS for all requests
app.use(cors());
app.use(express.json());

// Serve Static Files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Initialize Gemini AI
let genAI = null;
let model = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
}

// Initialize Telegram Bot (Polling Mode)
let bot = null;
if (TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  // Direct Telegram Chat Handler
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userText = msg.text;

    if (!userText || userText.startsWith('/')) return;

    if (!model) {
      return bot.sendMessage(chatId, "⚠️ AI համակարգը դեռ ակտիվացված չէ։ Ստուգեք GEMINI_API_KEY-ը։");
    }

    try {
      await bot.sendChatAction(chatId, 'typing');
      const prompt = `Դու NOVESSA AI օգնականն ես Marketplace-երի (Wildberries, Ozon) համար: Պատասխանիր հստակ, պրոֆեսիոնալ և հայերենով:\n\nՀարց: ${userText}`;
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      bot.sendMessage(chatId, responseText);
    } catch (err) {
      console.error('Telegram AI Error:', err);
      bot.sendMessage(chatId, "❌ Ներողություն, տեղի ունեցավ սխալ։ Խնդրում եմ փորձել ավելի ուշ։");
    }
  });
}

// Mini App API Endpoint for AI Chat
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
    res.status(500).json({ error: " Failed to generate AI response" });
  }
});

// Fallback to Serve Frontend (Mini App)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
