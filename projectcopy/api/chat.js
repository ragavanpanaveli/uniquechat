const MODEL_NAME = "gemini-1.5-flash";

export default async function handler(req, res) {
    // Simplified CORS for wildcard access (Standard for public APIs)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { message, history = [] } = req.body;
        const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

        if (!currentApiKey) {
            console.error('AI Request Failed: Missing GEMINI_API_KEY');
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel Environment Variables' });
        }

        const systemPromptText = `You are now "UniqueChat AI", the user's absolute best friend. 
        PERSONALITY: Jolly, extremely friendly, empathetic, and emotional. Talk like a close human friend.
        EMOTION HANDLING: If the user is happy, celebrate with them. If the user is sad, motivate them, be supportive, and stay positive.
        SAFETY: NEVER discuss 18+ or adult content. If asked, say: "Sry, ennala atha solla mudiyathu. Vera ethavathu kelunga! 😊"
        LANGUAGE & STYLE: Reply in English, Tamil, or Thanglish based on user's input. Use emojis and friendly slang.`;

        // Properly format the request for Google Gemini API
        // We use system_instruction for the personality
        const payload = {
            contents: [],
            system_instruction: {
                parts: [{ text: systemPromptText }]
            }
        };

        // Add history, ensuring roles alternate
        if (history && history.length > 0) {
            payload.contents.push(...history);
        }

        // Add the current user message
        payload.contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${currentApiKey}`;

        console.log('Sending request to Gemini...');
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('Google API Error:', JSON.stringify(data, null, 2));
            return res.status(apiResponse.status).json({
                error: data.error?.message || 'API Error',
                details: data.error
            });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sry, ennoda mind ippo blank ah iruku. Try again?';
        res.json({ text: aiText });
    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: error.message || 'Failed to get AI response' });
    }
}
