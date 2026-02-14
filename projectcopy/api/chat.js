export default async function handler(req, res) {
    // 1. ROBUST CORS
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
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel settings' });
        }

        const systemPromptText = `You are "UniqueChat AI", the user's best friend. Style: Jolly, funny, and supportive. Use emojis!`;

        const payload = {
            contents: [],
            system_instruction: {
                parts: [{ text: systemPromptText }]
            }
        };

        if (history && history.length > 0) {
            payload.contents.push(...history);
        }

        payload.contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        // Loop through multiple possible model names to find the best working one
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-1.0-pro"];
        let lastError = null;
        let finalData = null;

        for (const model of modelsToTry) {
            try {
                // Using stable v1 endpoint
                const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${currentApiKey}`;
                console.log(`Trying Gemini model: ${model}...`);

                const apiResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await apiResponse.json();

                if (apiResponse.ok) {
                    finalData = data;
                    break;
                } else {
                    console.error(`Model ${model} failed:`, data.error?.message);
                    lastError = data.error;
                    if (data.error?.message?.toLowerCase().includes('quota')) break;
                    if (data.error?.message?.toLowerCase().includes('key')) break;
                }
            } catch (e) {
                console.error(`Fetch error for ${model}:`, e);
            }
        }

        if (!finalData) {
            return res.status(500).json({
                error: lastError?.message || 'All AI models failed. Please check your API key and Vercel settings.',
                details: lastError
            });
        }

        const aiText = finalData.candidates?.[0]?.content?.parts?.[0]?.text || "Machi, enna solrathunney theriyala. Try again!";
        res.json({ text: aiText });

    } catch (error) {
        console.error('Server Internal Error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
