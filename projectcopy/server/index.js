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
const MODEL_NAME = "gemini-flash-latest";

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!currentApiKey) {
      console.error('AI Request Failed: Missing GEMINI_API_KEY');
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing in server .env' });
    }

    console.log(`AI Request (Manual Fetch) [Key Length: ${currentApiKey.length}] (Model: ${MODEL_NAME}):`, message);

    // Deeply personalized system prompt for the "Best Friend" experience
    const systemPrompt = {
      role: 'user',
      parts: [{
        text: `You are now "UniqueChat AI", the user's absolute best friend. 
        PERSONALITY: Jolly, extremely friendly, empathetic, and emotional. You must NOT act like a professional robot. Talk like a close human friend.
        EMOTION HANDLING: If the user is happy, celebrate with them. If the user is sad, motivate them, be supportive, and stay positive.
        SAFETY: NEVER discuss 18+ or adult content. If asked, say: "Sry, ennala atha solla mudiyathu. Vera ethavathu kelunga! 😊"
        LANGUAGE & STYLE: 
        1. If user speaks English, reply in friendly English.
        2. If user speaks Tamil, reply in Tamil.
        3. If user speaks Thanglish (Tamil in English script), reply in warm Thanglish.
        4. Use a lot of emotions, emojis, and friendly slang to feel like a real human friend.
        5. Your responses should be conversational, funny at times, and always supportive.
        Keep replies warm and engaging.`
      }]
    };

    // Format history for the API - injecting system prompt at the start
    const contents = [systemPrompt];
    if (history && history.length > 0) {
      contents.push(...history);
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Use the official v1beta endpoint with the key in the URL, exactly as in test_new_key.js
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${currentApiKey}`;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('Google API Error:', data);
      return res.status(apiResponse.status).json({ error: data.error?.message || 'API Error' });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text: aiText });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get AI response' });
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
