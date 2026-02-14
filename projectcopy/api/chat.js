export default async function handler(req, res) {
    // 1. ROBUST CORS (Required for cross-domain requests)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Please use POST request' });
    }

    try {
        const { message, history = [] } = req.body;
        const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

        if (!currentApiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel settings for the BACKEND project.' });
        }

        // Instructions for the AI - using a format that works on ALL API versions
        const systemPromptText = "You are UniqueChat AI, a jolly best friend. Talk like a close human friend. Emphatetic and Jolly. Use emojis. Reply in Tamil/English/Thanglish.";

        const contents = [];
        if (history && history.length > 0) {
            // If they are in the middle of a chat, just append
            contents.push(...history);
            contents.push({ role: 'user', parts: [{ text: message }] });
        } else {
            // First message: include the personality instructions
            contents.push({ role: 'user', parts: [{ text: `${systemPromptText}\n\nUser: ${message}` }] });
        }

        // Try both v1 and v1beta to ensure maximum compatibility
        const endpoints = [
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${currentApiKey}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${currentApiKey}`,
            `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${currentApiKey}`
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
                console.error(`Attempt failed with ${url.split('/')[4]}:`, data.error?.message);
            } catch (e) {
                console.error(`Fetch error:`, e.message);
                lastError = e;
            }
        }

        if (!finalData) {
            return res.status(500).json({
                error: lastError?.message || 'Chatbot failed to respond. Please check your API key connectivity.',
                details: lastError
            });
        }

        const aiText = finalData.candidates?.[0]?.content?.parts?.[0]?.text || "Machi, something went wrong. Try again!";
        res.json({ text: aiText });

    } catch (error) {
        console.error('Server Internal Error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
