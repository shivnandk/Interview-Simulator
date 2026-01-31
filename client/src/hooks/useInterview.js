import { useState, useEffect, useRef, useCallback } from 'react';

export const useInterview = () => {
    const [status, setStatus] = useState({ state: 'default', text: 'Ready' });
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Click 'Start Interview' to begin. I'm ready when you are!", isSystem: true }
    ]);
    const [isRecording, setIsRecording] = useState(false);

    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const microphoneRef = useRef(null);
    const nextPlayTimeRef = useRef(0);

    const scrollToBottom = useCallback(() => {
        const transcriptEl = document.getElementById('transcript');
        if (transcriptEl) {
            requestAnimationFrame(() => {
                transcriptEl.scrollTop = transcriptEl.scrollHeight;
            });
        }
    }, []);

    const updateStatus = (state, text) => {
        setStatus({ state, text });
    };

    const handleMessage = useCallback((msg) => {
        if (msg.type === 'stt_partial') {
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'user' && lastMsg.id === 'temp-user-msg') {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = msg.text;
                    return newMessages;
                } else {
                    return [...prev, { role: 'user', content: msg.text, id: 'temp-user-msg' }];
                }
            });
            updateStatus('listening', 'Listening...');
            scrollToBottom();
        } else if (msg.type === 'status') {
            if (msg.text.includes('Speaking')) updateStatus('listening', 'User Speaking');
            else if (msg.text.includes('Processing')) updateStatus('processing', 'AI Thinking...');
            else if (msg.text.includes('Listening')) updateStatus('listening', 'Listening...');
            else updateStatus('default', msg.text);
        } else if (msg.type === 'llm_response') {
            setMessages(prev => {
                // Finalize the temp user message if it exists
                const filtered = prev.map(m => m.id === 'temp-user-msg' ? { ...m, id: undefined } : m);
                return [...filtered, { role: 'assistant', content: msg.text }];
            });
            updateStatus('speaking', 'AI Speaking');
            scrollToBottom();
        }
    }, [scrollToBottom]);

    const playAudioChunk = useCallback(async (arrayBuffer) => {
        if (!audioContextRef.current) return;

        const int16 = new Int16Array(arrayBuffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768.0;
        }

        const buffer = audioContextRef.current.createBuffer(1, float32.length, 16000);
        buffer.getChannelData(0).set(float32);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);

        const currentTime = audioContextRef.current.currentTime;
        if (nextPlayTimeRef.current < currentTime) {
            nextPlayTimeRef.current = currentTime;
        }

        source.start(nextPlayTimeRef.current);
        nextPlayTimeRef.current += buffer.duration;
    }, []);

    const startAudio = async () => {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

        microphoneRef.current.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);

        processorRef.current.onaudioprocess = (e) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    let s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                wsRef.current.send(pcm16.buffer);
            }
        };
    };

    const start = async () => {
        try {
            updateStatus('processing', "Connecting...");

            // Handle split deployment: use env var if set, otherwise fallback to local window host
            const backendUrl = import.meta.env.VITE_BACKEND_URL;
            let wsUrl;

            if (backendUrl) {
                // If backendUrl is set (e.g., https://my-backend.onrender.com)
                // convert it to wss:// for websockets
                wsUrl = backendUrl.replace('http', 'ws');
            } else {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                // Local dev fallback
                const host = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
                wsUrl = `${protocol}//${host}`;
            }

            console.log("Connecting to:", wsUrl);
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = async () => {
                updateStatus('listening', "Connected! Starting Audio...");
                await startAudio();
                setIsRecording(true);
                updateStatus('listening', "Listening...");
            };

            wsRef.current.onmessage = async (event) => {
                if (event.data instanceof Blob) {
                    const arrayBuffer = await event.data.arrayBuffer();
                    playAudioChunk(arrayBuffer);
                } else {
                    const msg = JSON.parse(event.data);
                    handleMessage(msg);
                }
            };

            wsRef.current.onclose = () => {
                updateStatus('default', "Disconnected");
                stop();
            };

            wsRef.current.onerror = (e) => {
                console.error(e);
                updateStatus('default', "Error");
            };
        } catch (e) {
            alert(e.message);
        }
    };

    const stop = () => {
        setIsRecording(false);
        if (microphoneRef.current) microphoneRef.current.disconnect();
        if (processorRef.current) processorRef.current.disconnect();
        if (audioContextRef.current) audioContextRef.current.close();
        if (wsRef.current) wsRef.current.close();
        updateStatus('default', "Stopped");
    };

    return { status, messages, isRecording, start, stop };
};
