const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
require('dotenv').config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

function createSTTConnection(socket) {
    const connection = deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
        encoding: "linear16",
        sample_rate: 16000,
        channels: 1,
        interim_results: true,
        endpointing: 300, // Deepgram's internal VAD (backup to our manual one)
        vad_events: true,
    });

    return connection;
}

async function generateTTS(text) {
    try {
        const response = await deepgram.speak.request(
            { text },
            {
                model: "aura-asteria-en",
                encoding: "linear16",
                sample_rate: 16000,
            }
        );

        const stream = await response.getStream();
        if (stream) {
            // Convert web readable stream to buffer (Node.js)
            const buffer = await streamToBuffer(stream);
            return buffer;
        } else {
            console.error("Error generating audio stream");
            return null;
        }
    } catch (error) {
        console.error("Deepgram TTS Error:", error);
        return null; // Return null on error
    }
}

// Helper to convert readable stream to buffer
async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

module.exports = { createSTTConnection, generateTTS, LiveTranscriptionEvents };
