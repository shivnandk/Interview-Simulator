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

const { createSTTConnection, generateTTS, LiveTranscriptionEvents } =
    require('./services/deepgram');
const { getReply } = require('./services/groq');

/* =========================
   WebSocket Protocol Events
========================= */
const WS_EVENTS = {
    STT_PARTIAL: 'stt_partial',
    LLM_RESPONSE: 'llm_response',
    STATUS: 'status',
    ERROR: 'error'
};

// Initialize DB
initDB();

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// Serve static files (optional)
const publicPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

// -------- REST APIs --------

app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await getAllSessions();
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/history/:sessionId', async (req, res) => {
    try {
        const history = await getFullHistory(req.params.sessionId);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SPA fallback
app.use((req, res, next) => {
    if (req.method === 'GET' && fs.existsSync(publicPath)) {
        res.sendFile(path.join(publicPath, 'index.html'));
    } else {
        next();
    }
});

const server = http.createServer(app);

// -------- WebSocket (Voice) --------

const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws) => {
    console.log('Client connected (WS)');

    const sessionId = 'session_' + Date.now();
    await createSession(sessionId);

    let isAIProcessing = false;
    let sessionConfig = null;
    const stt = createSTTConnection();

    const handleAIResponse = async (userMessage) => {
        if (isAIProcessing) return;
        isAIProcessing = true;

        ws.send(JSON.stringify({
            type: WS_EVENTS.STATUS,
            state: 'processing',
            text: 'AI Thinking...'
        }));

        try {
            if (userMessage) {
                await addMessage(sessionId, 'user', userMessage);
            }

            const history = await getRecentMessages(sessionId, 6);
            const aiReply = await getReply(history, userMessage, sessionConfig);

            await addMessage(sessionId, 'assistant', aiReply);

            ws.send(JSON.stringify({
                type: WS_EVENTS.LLM_RESPONSE,
                text: aiReply
            }));

            const audioBuffer = await generateTTS(aiReply);
            if (audioBuffer) {
                ws.send(audioBuffer);
            }

        } catch (err) {
            console.error('Pipeline Error:', err);
            ws.send(JSON.stringify({
                type: WS_EVENTS.ERROR,
                text: 'Internal server error'
            }));
        } finally {
            isAIProcessing = false;
            ws.send(JSON.stringify({
                type: WS_EVENTS.STATUS,
                state: 'listening',
                text: 'Listening...'
            }));
        }
    };

    // --- Deepgram Transcription ---
    stt.on(LiveTranscriptionEvents.Transcript, async (data) => {
        const alt = data.channel.alternatives[0];
        if (!alt || !alt.transcript) return;

        // Partial transcript → UI only
        if (!data.is_final) {
            ws.send(JSON.stringify({
                type: WS_EVENTS.STT_PARTIAL,
                text: alt.transcript
            }));
            return;
        }

        // Final transcript → trigger LLM
        const userMessage = alt.transcript.trim();
        if (!userMessage) return;

        await handleAIResponse(userMessage);
    });

    // --- Audio stream from client → Deepgram ---
    ws.on('message', async (message) => {
        if (Buffer.isBuffer(message)) {
            if (stt.getReadyState() === 1) {
                stt.send(message);
            }
        } else {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'init_interview') {
                    sessionConfig = data.config;
                    await updateSessionConfig(sessionId, sessionConfig);
                    console.log(`Session ${sessionId} initialized with config:`, sessionConfig);

                    // Auto-trigger first question
                    await handleAIResponse(null);
                }
            } catch (err) {
                console.error('WS JSON Parse Error:', err);
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected (WS)');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
