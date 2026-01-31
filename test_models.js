const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        // There is no direct "listModels" on the client instance in some versions,
        // but let's try to infer or just test a standard list.
        // Actually, the SDK doesn't always expose listModels easily in the simplified client.
        // We will try a different approach: just try to instantiate a few common models and run a 'hello' prompt.

        const candidates = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash-002",
            "gemini-1.5-pro",
            "gemini-pro",
            "gemini-2.0-flash-exp"
        ];

        console.log("Testing models...");

        for (const modelName of candidates) {
            process.stdout.write(`Testing ${modelName}... `);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello");
                const response = await result.response;
                console.log("SUCCESS! ✅");
            } catch (e) {
                console.log(`FAILED ❌ (${e.status || e.message})`);
            }
        }

    } catch (e) {
        console.error(e);
    }
}

listModels();
