const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Server is Live! Reach API at /api/chat'));

app.post(['/api/ai/chat', '/api/chat'], async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!currentApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
    }

    const systemPromptText = `INSTRUCTIONS: You are "UniqueChat AI", the user's best friend. Style: Jolly, funny, and supportive. Use emojis!`;

    const contents = [];
    if (history && history.length > 0) {
      contents.push(...history);
      contents.push({ role: 'user', parts: [{ text: message }] });
    } else {
      contents.push({ role: 'user', parts: [{ text: `${systemPromptText}\n\nUser: ${message}` }] });
    }

    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-1.0-pro"];
    let finalData = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentApiKey}`;
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        });
        const data = await apiResponse.json();
        if (apiResponse.ok) {
          finalData = data;
          break;
        }
        lastError = data.error;
      } catch (e) {
        console.error(`Local fetch error: ${e.message}`);
      }
    }

    if (!finalData) {
      return res.status(500).json({ error: lastError?.message || 'All AI models failed' });
    }

    const aiText = finalData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI';
    res.json({ text: aiText });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
