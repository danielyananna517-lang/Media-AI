const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

// Serving Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Initialize Gemini API with stable & fast model
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

  // Bot direct chat handling with Gemini AI
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userText = msg.text;

    // Ignore commands like /start
    if (!userText || userText.startsWith('/')) return;

    if (!model) {
      return bot.sendMessage(chatId, "⚠️ AI-ն համակարգում դեռ ակտիվացված չէ։ Ստուգեք GEMINI_API_KEY-ը:");
    }

    try {
      await bot.sendChatAction(chatId, 'typing');
      const prompt = `Դու NOVESSA AI օգնականն ես Marketplace-երի (Wildberries, Ozon) համար: Պատասխանիր հստակ ու պրոֆեսիոնալ:\n\nՀարց: ${userText}`;
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Telegram AI Error:', err);
      bot.sendMessage(chatId, "❌ Ներողություն, տեղի ունեցավ սխալ: Խնդրում եմ փորձել փոքր-ինչ ուշ:");
    }
  });
}

// Web API endpoint for Mini App Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!model) {
      return res.status(500).json({ error: "Gemini API key missing" });
    }

    const result = await model.generateContent(message);
    const responseText = result.response.text();
    res.json({ response: responseText });
  } catch (error) {
    console.error("API Chat Error:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

// Serve Frontend Mini App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
