const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Main AI Route
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return res.status(500).json({ error: 'AI Error: Gemini API Key is missing on the server.' });
    }

    // Persona & Instructions
    const systemPrompt = "UniqueChat AI: You are a friendly, supportive best friend. Use emojis. Reply in a mix of Tamil, English, and Thanglish. Keep it casual and helpful.";

    // Prepare contents for Gemini API (Vertex/AI Studio format)
    const contents = [];

    // If history is empty, we must inject the system prompt into the first user message
    if (history.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }]
      });
    } else {
      // Map history to standard Gemini roles
      const formattedHistory = history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: h.parts.map(p => ({ text: p.text }))
      }));
      contents.push(...formattedHistory, {
        role: 'user',
        parts: [{ text: message }]
      });
    }

    const MODEL_NAME = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || 'Gemini API rejected the request.';
      console.error('Gemini API Error:', errMsg);

      // Detect quota/rate limit errors
      if (response.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate')) {
        return res.status(429).json({ error: '⏳ API quota exceeded. Please wait a minute and try again, or get a new API key from https://aistudio.google.com' });
      }

      return res.status(response.status).json({ error: errMsg });
    }

    // Basic Safety Check for result
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      return res.json({ text: "Machi, I'm a bit stuck. Can you try saying that again?" });
    }

    res.json({ text: aiText });

  } catch (error) {
    console.error('Server Crash Error:', error);
    res.status(500).json({ error: 'Internal Server Error: AI is resting right now.' });
  }
});

// Health check
app.get('/', (req, res) => res.send('UniqueChat AI Backend is Running 🚀'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[SERVER] UniqueChat AI Live on Port ${PORT}`));
