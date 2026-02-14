const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Debug log for environment variables (safely)
console.log('--- Server Debug ---');
console.log('PORT:', port);
console.log('GEMINI_API_KEY Length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
console.log('GEMINI_API_KEY starts with:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) : 'MISSING');
console.log('--------------------');

app.use(cors());
app.use(express.json());

// Trim the key to prevent whitespace errors
// Standardized model name for the SDK
const MODEL_NAME = "gemini-1.5-flash-latest";

app.get('/', (req, res) => res.send('Server is Live! Reach API at /api/chat'));

app.post(['/api/ai/chat', '/api/chat'], async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!currentApiKey) {
      console.error('AI Request Failed: Missing GEMINI_API_KEY');
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
    }

    const payload = {
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
      system_instruction: {
        parts: [{ text: "You are UniqueChat AI, the user's best friend. Style: Jolly, funny, and supportive. Language: English, Tamil, and Thanglish. Use emojis!" }]
      }
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${currentApiKey}`;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('Google API Error:', data);
      return res.status(apiResponse.status).json({ error: data.error?.message || 'API Error' });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sry machi, small error. Try again?';
    res.json({ text: aiText });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get AI response' });
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
