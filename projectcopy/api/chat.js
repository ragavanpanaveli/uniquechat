export default async function handler(req, res) {
    // 1. Standard CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // A small helper to test if the API is reaching Google
    if (req.method === 'GET') {
        return res.json({ status: "Backend is Live! Send a POST request to chat." });
    }

    try {
        const { message, history = [] } = req.body;
        const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

        if (!currentApiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel. Please add it in project settings.' });
        }

        // Instructions
        const instructions = "UniqueChat AI: Friendly best friend. Use emojis! Reply in Tamil/English.";

        const contents = [];
        if (history && history.length > 0) {
            contents.push(...history);
            contents.push({ role: 'user', parts: [{ text: message }] });
        } else {
            contents.push({ role: 'user', parts: [{ text: `${instructions}\n\nUser: ${message}` }] });
        }

        /**
         * We will loop through 3 most common model patterns 
         * and 2 API versions to find exactly what Google wants.
         */
        const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
        const versions = ["v1", "v1beta"];

        let finalData = null;
        let lastError = null;

        for (const model of models) {
            for (const ver of versions) {
                try {
                    const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${currentApiKey}`;

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents })
                    });

                    const data = await response.json();

                    if (response.ok) {
                        finalData = data;
                        break;
                    } else {
                        lastError = data.error;
                        // If it's a critical error (Quota or Key), no point in trying more
                        const msg = data.error?.message?.toLowerCase() || '';
                        if (msg.includes('quota') || msg.includes('key')) {
                            return res.status(response.status).json({ error: data.error.message });
                        }
                    }
                } catch (e) {
                    console.error('Fetch attempt failed');
                }
            }
            if (finalData) break;
        }

        if (!finalData) {
            return res.status(500).json({
                error: lastError?.message || 'Google rejected all model IDs. Try creating a NEW API key in AI Studio.',
                details: lastError
            });
        }

        const aiText = finalData.candidates?.[0]?.content?.parts?.[0]?.text || "Machi, small error. Try again!";
        res.json({ text: aiText });

    } catch (error) {
        res.status(500).json({ error: 'Server Internal Error', details: error.message });
    }
}
