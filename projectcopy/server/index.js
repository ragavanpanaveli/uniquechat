const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('UniqueChat Backend is running!'));

app.post(['/api/chat', '/api/ai/chat'], async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!currentApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
    }

    const contents = [];
    if (history.length > 0) {
      contents.push(...history, { role: 'user', parts: [{ text: message }] });
    } else {
      contents.push({ role: 'user', parts: [{ text: `Instructions: Jolly best friend bot.\n\nUser: ${message}` }] });
    }

    const endpoints = [
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${currentApiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${currentApiKey}`
    ];

    let finalData = null;
    let lastError = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        });
        const data = await response.json();
        if (response.ok) {
          finalData = data;
          break;
        }
        lastError = data.error;
      } catch (e) {
        console.error(e);
      }
    }

    if (!finalData) {
      return res.status(500).json({ error: lastError?.message || 'AI error' });
    }

    res.json({ text: finalData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
