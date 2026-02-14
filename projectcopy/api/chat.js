const MODEL_NAME = "gemini-2.0-flash";

export default async function handler(req, res) {
    // 1. ROBUST CORS (Allow-Origin: * is fine as long as Credentials is not true)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 2. Handle OPTIONS (Pre-flight check)
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
            console.error('API Key Missing');
            return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel settings for this project' });
        }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const systemPromptText = `You are "UniqueChat AI", the user's best friend. 
        Style: Jolly, funny, and supportive. 
        Language: English, Tamil, and Thanglish. 
        Use plenty of emojis!`;

        const payload = {
            contents: [],
            system_instruction: {
                parts: [{ text: systemPromptText }]
            }
        };

        // Ensure roles alternate correctly in history
        if (history && history.length > 0) {
            payload.contents.push(...history);
        }

        // Current message
        payload.contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${currentApiKey}`;

        console.log('Requesting Gemini API...');
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('Gemini Error:', data.error);
            return res.status(apiResponse.status).json({
                error: data.error?.message || 'API Error',
                code: data.error?.status
            });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Machi, small error. Try again!";
        res.json({ text: aiText });

    } catch (error) {
        console.error('Server Internal Error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
