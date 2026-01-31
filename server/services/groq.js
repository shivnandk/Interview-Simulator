const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a backend interview assistant.
You ask follow-up questions.
You give hints, not full answers.
You respond concisely.
You wait for the user to finish speaking.`;

async function getReply(history, userMessage) {
    try {
        // DB returns [{role: 'user'|'assistant', content: '...'}, ...]
        // Groq uses standard OpenAI format: {role: 'user'|'assistant'|'system', content: '...'}
        // We match perfectly, just prepend system prompt.

        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history,
            { role: "user", content: userMessage }
        ];

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile", // Updated from decommissioned model
            temperature: 0.6,
            max_tokens: 200,
        });

        return chatCompletion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error("Groq API Error:", error);
        return "I'm having a bit of trouble connecting to my new brain.";
    }
}

module.exports = { getReply };
