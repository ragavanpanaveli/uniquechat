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

        const systemPromptText = `INSTRUCTIONS: You are "UniqueChat AI", the user's best friend. Style: Jolly, funny, and supportive. Use emojis!`;

        // Classic formatting: System prompt as the VERY FIRST message
        // This works on ALL models (1.0, 1.5, Pro, Flash)
        const contents = [];

        // Add the system instructions as the very first part of the first user message
        const firstMessageText = `${systemPromptText}\n\nUser says: ${message}`;

        if (history && history.length > 0) {
            // If there's history, we put the instructions at the very beginning of the history
            contents.push(...history);
            contents.push({
                role: 'user',
                parts: [{ text: message }]
            });
        } else {
            // No history, just the prompt + current message
            contents.push({
                role: 'user',
                parts: [{ text: firstMessageText }]
            });
        }

        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-1.0-pro"];
        let lastError = null;
        let finalData = null;

        for (const model of modelsToTry) {
            try {
                // Using v1beta as it is most flexible with model aliases
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentApiKey}`;

                const apiResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents })
                });

                const data = await apiResponse.json();

                if (apiResponse.ok) {
                    finalData = data;
                    break;
                } else {
                    console.error(`Model ${model} failed:`, data.error?.message);
                    lastError = data.error;
                    if (data.error?.message?.toLowerCase().includes('quota')) break;
                }
            } catch (e) {
                console.error(`Fetch error for ${model}:`, e);
            }
        }

        if (!finalData) {
            return res.status(500).json({
                error: lastError?.message || 'All AI models failed. Please check your API key.',
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
