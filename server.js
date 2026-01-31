const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { initDB, createSession, addMessage, getRecentMessages } = require('./services/db');
const VAD = require('./services/vad');
const { createSTTConnection, generateTTS, LiveTranscriptionEvents } = require('./services/deepgram');
const { getReply } = require('./services/groq');

// Initialize DB
initDB();

const server = http.createServer((req, res) => {
    // Serve static files for frontend
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'public/index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else if (req.url === '/client.js') {
        fs.readFile(path.join(__dirname, 'public/client.js'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading client.js');
            } else {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws) => {
    console.log('Client connected');
    const sessionId = 'session_' + Date.now();
    await createSession(sessionId);

    // Session State
    let currentTranscript = "";
    let latestPartial = "";
    let isAIProcessing = false;

    // Components
    const vad = new VAD(0.02, 800); // 0.02 threshold, 800ms silence
    const stt = createSTTConnection();

    // STT Events
    stt.on(LiveTranscriptionEvents.Open, () => {
        console.log("Deepgram STT Connected");
    });

    stt.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alt = data.channel.alternatives[0];
        if (alt && alt.transcript) {
            const text = alt.transcript;

            if (data.is_final) {
                currentTranscript += " " + text;
                latestPartial = "";
            } else {
                latestPartial = text;
            }

            ws.send(JSON.stringify({ type: 'stt_partial', text: currentTranscript + " " + latestPartial }));
        }
    });

    stt.on(LiveTranscriptionEvents.Error, (err) => {
        console.error("Deepgram Error:", err);
    });

    // VAD Events
    vad.onSpeechStart = () => {
        console.log("User started speaking");
        // Interrupt AI if speaking?
        // In a real app we'd send an "interrupt" event to client to stop audio playback.
        if (isAIProcessing) {
            console.log("Interrupting AI...");
            // We can't easily cancel the HTTP request to Gemini, but we can ignore result.
            // But for now, strict turn taking: user overrides.
        }
        ws.send(JSON.stringify({ type: 'status', text: 'User Speaking...' }));
    };

    vad.onSilence = async () => {
        console.log("User finished speaking (VAD)");
        ws.send(JSON.stringify({ type: 'status', text: 'Processing...' }));

        let fullMessage = (currentTranscript + " " + latestPartial).trim();

        if (!fullMessage) {
            console.log("Silence detected but no transcript. Ignoring.");
            return;
        }

        if (isAIProcessing) return;
        isAIProcessing = true;

        const userMessage = fullMessage;
        currentTranscript = "";
        latestPartial = "";

        try {
            // 1. Save User Message
            await addMessage(sessionId, 'user', userMessage);

            // 2. Get Context
            const history = await getRecentMessages(sessionId, 6);

            // 3. Call Gemini
            const aiReply = await getReply(history, userMessage);
            console.log("AI Reply:", aiReply);

            // 4. Save AI Message
            await addMessage(sessionId, 'assistant', aiReply);

            // 5. Send generic 'text' event (optional, for UI)
            ws.send(JSON.stringify({ type: 'llm_response', text: aiReply }));

            // 6. Generate TTS
            const audioBuffer = await generateTTS(aiReply);
            if (audioBuffer) {
                // Send audio to client
                // Note: We send binary message
                ws.send(audioBuffer);
            }

        } catch (e) {
            console.error("Pipeline Error:", e);
        } finally {
            isAIProcessing = false;
            ws.send(JSON.stringify({ type: 'status', text: 'Listening...' }));
        }
    };

    ws.on('message', (message) => {
        if (Buffer.isBuffer(message)) {
            // Audio Chunk
            // 1. Feed to VAD
            vad.processAudio(message);

            // 2. Feed to STT
            if (stt.getReadyState() === 1) { // Open
                stt.send(message);
            }
        } else {
            // Text Event (Start/Stop?)
            try {
                const event = JSON.parse(message);
                if (event.type === 'start') {
                    // Handled by connection logic
                }
            } catch (e) { }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        // connection.finish() if needed
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
