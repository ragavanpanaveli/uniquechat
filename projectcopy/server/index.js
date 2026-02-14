const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Server live!'));

app.post(['/api/chat', '/api/ai/chat'], async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!currentApiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });

    const contents = [];
    if (history.length > 0) {
      contents.push(...history, { role: 'user', parts: [{ text: message }] });
    } else {
      contents.push({ role: 'user', parts: [{ text: `Instructions: Friendly best friend.\n\nUser: ${message}` }] });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message });

    res.json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response' });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
