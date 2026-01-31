const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const {
    initDB,
    createSession,
    addMessage,
    getRecentMessages,
    getAllSessions,
    getFullHistory
} = require('./services/db');
const VAD = require('./services/vad');
const { createSTTConnection, generateTTS, LiveTranscriptionEvents } = require('./services/deepgram');
const { getReply } = require('./services/groq');

// Initialize DB
initDB();

const app = express();
// Enable CORS for cross-origin requests (Vercel -> Render)
app.use(cors({
    origin: '*', // For production, you can set this to your Vercel URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Serve static files from React build folder (Optional for split deployment)
const publicPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(publicPath)) {
    console.log("Serving static files from:", publicPath);
    app.use(express.static(publicPath));
} else {
    console.log("Static files folder not found. Serving API only mode.");
}

// --- REST API OVER NODE (EXPRESS) ---

// 1. Get all sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await getAllSessions();
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get history for a specific session
app.get('/api/history/:sessionId', async (req, res) => {
    try {
        const history = await getFullHistory(req.params.sessionId);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback for SPA
app.use((req, res, next) => {
    if (req.method === 'GET' && fs.existsSync(publicPath)) {
        res.sendFile(path.join(publicPath, 'index.html'));
    } else {
        next();
    }
});

// Create HTTP server
const server = http.createServer(app);

// --- WEBSOCKET FOR VOICE ---
const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws) => {
    console.log('Client connected (WS)');
    const sessionId = 'session_' + Date.now();
    await createSession(sessionId);

    let currentTranscript = "";
    let latestPartial = "";
    let isAIProcessing = false;

    const vad = new VAD(0.02, 800);
    const stt = createSTTConnection();

    stt.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alt = data.channel.alternatives[0];
        if (alt && alt.transcript) {
            if (data.is_final) {
                currentTranscript += " " + alt.transcript;
                latestPartial = "";
            } else {
                latestPartial = alt.transcript;
            }
            ws.send(JSON.stringify({ type: 'stt_partial', text: (currentTranscript + " " + latestPartial).trim() }));
        }
    });

    vad.onSpeechStart = () => {
        ws.send(JSON.stringify({ type: 'status', text: 'User Speaking...' }));
    };

    vad.onSilence = async () => {
        let fullMessage = (currentTranscript + " " + latestPartial).trim();
        if (!fullMessage || isAIProcessing) return;

        isAIProcessing = true;
        ws.send(JSON.stringify({ type: 'status', text: 'Processing...' }));

        currentTranscript = "";
        latestPartial = "";

        try {
            await addMessage(sessionId, 'user', fullMessage);
            const history = await getRecentMessages(sessionId, 6);
            const aiReply = await getReply(history, fullMessage);

            await addMessage(sessionId, 'assistant', aiReply);
            ws.send(JSON.stringify({ type: 'llm_response', text: aiReply }));

            const audioBuffer = await generateTTS(aiReply);
            if (audioBuffer) ws.send(audioBuffer);
        } catch (e) {
            console.error("Pipeline Error:", e);
        } finally {
            isAIProcessing = false;
            ws.send(JSON.stringify({ type: 'status', text: 'Listening...' }));
        }
    };

    ws.on('message', (message) => {
        if (Buffer.isBuffer(message)) {
            vad.processAudio(message);
            if (stt.getReadyState() === 1) stt.send(message);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected (WS)');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Express server with REST + WS listening on port ${PORT}`);
});
