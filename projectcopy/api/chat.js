export default async function handler(req, res) {
    // 1. Standard CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { message, history = [] } = req.body;
        const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

        if (!currentApiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
        }

        // Specific model as requested
        const MODEL_NAME = "gemini-2.0-flash";

        // Classic prompt structure
        const instructions = "UniqueChat AI: Friendly best friend. Use emojis! Reply in Tamil/English.";
        const contents = [];
        if (history && history.length > 0) {
            contents.push(...history, { role: 'user', parts: [{ text: message }] });
        } else {
            contents.push({ role: 'user', parts: [{ text: `${instructions}\n\nUser: ${message}` }] });
        }

        // v1beta is the correct version for 2.0-flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${currentApiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API Error:', data.error?.message);
            return res.status(response.status).json({ error: data.error?.message || 'AI Error' });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Machi, small error. Try again!";
        res.json({ text: aiText });

    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
