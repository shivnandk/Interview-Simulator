const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const SYSTEM_PROMPT = `You are a backend interview assistant.
You ask follow-up questions.
You give hints, not full answers.
You respond concisely.
You wait for the user to finish speaking.`;

async function getReply(history, userMessage) {
    try {
        // Construct chat history for Gemini
        // We need to map our DB roles to Gemini roles ('user' -> 'user', 'assistant' -> 'model')
        const chatHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: SYSTEM_PROMPT }], // Inject system prompt as first user message or use system parameters if supported simpler
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I am ready to conduct the interview." }],
                },
                ...chatHistory
            ],
            generationConfig: {
                maxOutputTokens: 200, // Keep it concise
            },
        });

        const result = await chat.sendMessage(userMessage);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "I'm sorry, I'm having trouble connecting to my brain right now.";
    }
}

module.exports = { getReply };
