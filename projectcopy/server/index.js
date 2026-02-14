const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Backend Server is Live!'));

app.post(['/api/chat', '/api/ai/chat'], async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!currentApiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });

    const contents = [...history, { role: 'user', parts: [{ text: `Instructions: Friendly Best Friend. Use emojis.\n\nUser: ${message}` }] }];

    const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest"];
    let finalData = null;
    let lastError = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${currentApiKey}`;
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
      } catch (e) { console.error(e); }
    }

    if (!finalData) return res.status(500).json({ error: lastError?.message || 'AI error' });
    res.json({ text: finalData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response' });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
