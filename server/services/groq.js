const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function generateSystemPrompt(config) {
    const { role, experience, topics, style, difficulty } = config || {};

    return `You are an AI interviewer conduct a ${role || 'general'} interview.
Experience Level: ${experience || 'Not specified'}
Topics to cover: ${(topics || []).join(', ')}
Interview Style: ${style || 'Conversational'}
Difficulty level: ${difficulty || 'Medium'}

Rules:
1. Ask one question at a time.
2. Adjust the technical depth to the experience level and difficulty.
3. If the style is "hint-based", provide small hints if the user is stuck, but don't give full answers.
4. If the style is "strict", be professional and move to the next question if the user fails.
5. If the style is "conversational", engage more naturally with the user's responses.
6. Keep your responses concise and professional (max 2-3 sentences).
7. Start by introducing yourself and asking the first question immediately.`;
}

async function getReply(history, userMessage, config) {
    try {
        const systemPrompt = generateSystemPrompt(config);

        const messages = [
            { role: "system", content: systemPrompt },
            ...history,
        ];

        if (userMessage) {
            messages.push({ role: "user", content: userMessage });
        }

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            max_tokens: 250,
        });

        return chatCompletion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error("Groq API Error:", error);
        return "I'm having a bit of trouble connecting to my new brain.";
    }
}

module.exports = { getReply };
