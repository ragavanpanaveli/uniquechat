export default async function handler(req, res) {
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

        if (!currentApiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });

        // 1. Image Gen Command (Keep as it matches main.ts expectation)
        if (message && message.toLowerCase().startsWith('/generate ')) {
            const prompt = message.slice(10).trim();
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
            return res.json({
                text: `Machi, here is your generated image for: "${prompt}"`,
                generatedImage: imageUrl
            });
        }

        const MODEL_NAME = "gemini-2.0-flash"; // Latest stable version
        const systemPrompt = "UniqueChat AI: Friendly best friend. Use emojis! Reply in Tamil/English/Thanglish.";

        const contents = [];
        if (history && history.length === 0) {
            contents.push({ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }] });
        } else {
            const formattedHistory = (history || []).map((h) => ({
                role: h.role === 'model' ? 'model' : 'user',
                parts: h.parts.map((p) => ({ text: p.text }))
            }));
            contents.push(...formattedHistory, { role: 'user', parts: [{ text: message }] });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${currentApiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API Error:', data.error?.message || data);
            return res.status(response.status).json({ error: data.error?.message || 'AI Error' });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Machi, small error. Try again!";
        res.json({ text: aiText });

    } catch (error) {
        console.error('Internal Server Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

