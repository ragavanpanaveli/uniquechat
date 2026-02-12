const MODEL_NAME = "gemini-flash-latest";

export default async function handler(req, res) {
    // Add CORS headers for safety, although same-origin is preferred
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { message, history } = req.body;
        const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

        if (!currentApiKey) {
            console.error('AI Request Failed: Missing GEMINI_API_KEY');
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
        }

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

        // Format history for the API
        const contents = [systemPrompt];
        if (history && history.length > 0) {
            contents.push(...history);
        }
        contents.push({ role: 'user', parts: [{ text: message }] });

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
}
