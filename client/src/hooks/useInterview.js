import { useState, useEffect, useRef, useCallback } from 'react';

// Constants
const STATUS_STATES = {
    DEFAULT: 'default',
    LISTENING: 'listening',
    PROCESSING: 'processing',
    SPEAKING: 'speaking',
    ERROR: 'error',
    CONNECTING: 'connecting'
};

const WS_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 3;

export const useInterview = () => {
    const [status, setStatus] = useState({ state: STATUS_STATES.DEFAULT, text: 'Ready' });
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Click 'Start Interview' to begin. I'm ready when you are!", isSystem: true, id: 'welcome' }
    ]);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState(null);

    // Refs
    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const microphoneRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const nextPlayTimeRef = useRef(0);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const isCleaningUpRef = useRef(false);

    const scrollToBottom = useCallback(() => {
        const transcriptEl = document.getElementById('transcript');
        if (transcriptEl) {
            requestAnimationFrame(() => {
                transcriptEl.scrollTop = transcriptEl.scrollHeight;
            });
        }
    }, []);

    const updateStatus = useCallback((state, text) => {
        setStatus({ state, text });
    }, []);

    const addMessage = useCallback((message) => {
        setMessages(prev => [...prev, { ...message, id: message.id || Date.now() + Math.random() }]);
        scrollToBottom();
    }, [scrollToBottom]);

    const handleMessage = useCallback((msg) => {
        // Validate message structure
        if (!msg || typeof msg !== 'object' || !msg.type) {
            console.warn('Invalid message received:', msg);
            return;
        }

        switch (msg.type) {
            case 'stt_partial':
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'user' && lastMsg.isPartial) {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1] = {
                            ...lastMsg,
                            content: msg.text
                        };
                        return newMessages;
                    } else {
                        return [...prev, {
                            role: 'user',
                            content: msg.text,
                            isPartial: true,
                            id: 'partial-' + Date.now()
                        }];
                    }
                });
                updateStatus(STATUS_STATES.LISTENING, 'Listening...');
                scrollToBottom();
                break;

            case 'status':
                if (msg.text?.includes('Speaking')) {
                    updateStatus(STATUS_STATES.LISTENING, 'User Speaking');
                } else if (msg.text?.includes('Processing')) {
                    updateStatus(STATUS_STATES.PROCESSING, 'AI Thinking...');
                } else if (msg.text?.includes('Listening')) {
                    updateStatus(STATUS_STATES.LISTENING, 'Listening...');
                } else {
                    updateStatus(STATUS_STATES.DEFAULT, msg.text);
                }
                break;

            case 'llm_response':
                setMessages(prev => {
                    // Finalize any partial user message
                    const finalized = prev.map(m =>
                        m.isPartial ? { ...m, isPartial: false } : m
                    );
                    return [...finalized, {
                        role: 'assistant',
                        content: msg.text,
                        id: Date.now()
                    }];
                });
                updateStatus(STATUS_STATES.SPEAKING, 'AI Speaking');
                scrollToBottom();
                break;

            case 'error':
                setError(msg.text || 'An error occurred');
                updateStatus(STATUS_STATES.ERROR, 'Error occurred');
                break;

            default:
                console.warn('Unknown message type:', msg.type);
        }
    }, [updateStatus, scrollToBottom]);

    const playAudioChunk = useCallback(async (arrayBuffer) => {
        // Validate audio context state
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            console.warn('Audio context not available for playback');
            return;
        }

        // Validate buffer size
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            console.warn('Empty audio buffer received');
            return;
        }

        try {
            const int16 = new Int16Array(arrayBuffer);
            const float32 = new Float32Array(int16.length);

            // Convert PCM16 to Float32
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
        } catch (error) {
            console.error('Error playing audio chunk:', error);
        }
    }, []);

    const checkMicrophonePermission = async () => {
        try {
            // Try permissions API first (not supported in all browsers)
            if (navigator.permissions && navigator.permissions.query) {
                const result = await navigator.permissions.query({ name: 'microphone' });
                if (result.state === 'denied') {
                    throw new Error('Microphone permission denied');
                }
            }
            return true;
        } catch (error) {
            // Permissions API not supported, will be checked during getUserMedia
            return true;
        }
    };

    const startAudio = async () => {
        try {
            // Check permissions first
            await checkMicrophonePermission();

            // Create audio context
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            // Resume context if suspended (browser autoplay policy)
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            mediaStreamRef.current = stream;
            microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);

            // Note: ScriptProcessorNode is deprecated but AudioWorklet requires separate file
            // For production, consider implementing AudioWorklet
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

            return true;
        } catch (error) {
            console.error('Error starting audio:', error);
            
            if (error.name === 'NotAllowedError') {
                throw new Error('Microphone permission denied. Please allow access and try again.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No microphone found. Please connect a microphone and try again.');
            } else {
                throw new Error('Failed to start audio: ' + error.message);
            }
        }
    };

    const connectWebSocket = useCallback(async () => {
        return new Promise((resolve, reject) => {
            try {
                updateStatus(STATUS_STATES.CONNECTING, "Connecting...");

                // Get WebSocket URL
                const backendUrl = import.meta.env.VITE_BACKEND_URL;
                let wsUrl;

                if (backendUrl) {
                    wsUrl = backendUrl.replace(/^http/, 'ws');
                } else {
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const host = window.location.hostname === 'localhost'
                        ? 'localhost:3000'
                        : window.location.host;
                    wsUrl = `${protocol}//${host}`;
                }

                console.log("Connecting to:", wsUrl);
                const ws = new WebSocket(wsUrl);
                let connectionTimeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Connection timeout'));
                }, 10000);

                ws.onopen = () => {
                    clearTimeout(connectionTimeout);
                    console.log('WebSocket connected');
                    reconnectAttemptsRef.current = 0;
                    resolve();
                };

                ws.onmessage = async (event) => {
                    if (event.data instanceof Blob) {
                        const arrayBuffer = await event.data.arrayBuffer();
                        playAudioChunk(arrayBuffer);
                    } else {
                        try {
                            const msg = JSON.parse(event.data);
                            handleMessage(msg);
                        } catch (error) {
                            console.error('Error parsing message:', error);
                        }
                    }
                };

                ws.onclose = (event) => {
                    console.log('WebSocket closed:', event.code, event.reason);
                    
                    if (!isCleaningUpRef.current && isRecording) {
                        // Attempt reconnection
                        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                            reconnectAttemptsRef.current++;
                            updateStatus(STATUS_STATES.CONNECTING, `Reconnecting... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
                            
                            reconnectTimeoutRef.current = setTimeout(() => {
                                start();
                            }, WS_RECONNECT_DELAY);
                        } else {
                            updateStatus(STATUS_STATES.ERROR, "Connection lost");
                            stop();
                        }
                    }
                };

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    clearTimeout(connectionTimeout);
                    reject(new Error('WebSocket connection failed'));
                };

                wsRef.current = ws;
            } catch (error) {
                reject(error);
            }
        });
    }, [handleMessage, playAudioChunk, updateStatus, isRecording]);

    const start = async () => {
        try {
            setError(null);
            isCleaningUpRef.current = false;

            // Connect WebSocket
            await connectWebSocket();

            // Start audio
            updateStatus(STATUS_STATES.CONNECTING, "Starting audio...");
            await startAudio();

            setIsRecording(true);
            updateStatus(STATUS_STATES.LISTENING, "Listening...");
            
        } catch (error) {
            console.error('Error starting interview:', error);
            setError(error.message);
            updateStatus(STATUS_STATES.ERROR, "Failed to start");
            await stop();
        }
    };

    const stop = async () => {
        isCleaningUpRef.current = true;
        setIsRecording(false);

        // Clear reconnection timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        // Stop microphone stream
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        // Disconnect audio nodes
        if (microphoneRef.current) {
            try {
                microphoneRef.current.disconnect();
            } catch (e) {
                console.warn('Error disconnecting microphone:', e);
            }
            microphoneRef.current = null;
        }

        if (processorRef.current) {
            try {
                processorRef.current.disconnect();
                processorRef.current.onaudioprocess = null;
            } catch (e) {
                console.warn('Error disconnecting processor:', e);
            }
            processorRef.current = null;
        }

        // Close audio context
        if (audioContextRef.current) {
            try {
                await audioContextRef.current.close();
            } catch (e) {
                console.warn('Error closing audio context:', e);
            }
            audioContextRef.current = null;
        }

        // Close WebSocket
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch (e) {
                console.warn('Error closing WebSocket:', e);
            }
            wsRef.current = null;
        }

        nextPlayTimeRef.current = 0;
        reconnectAttemptsRef.current = 0;
        updateStatus(STATUS_STATES.DEFAULT, "Stopped");
    };

    const exportTranscript = useCallback(() => {
        const transcript = messages
            .filter(m => !m.isSystem)
            .map(m => `${m.role === 'user' ? 'You' : 'AI Interviewer'}: ${m.content}`)
            .join('\n\n');
        
        const blob = new Blob([transcript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interview-transcript-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }, [messages]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stop();
        };
    }, []);

    return {
        status,
        messages,
        isRecording,
        error,
        start,
        stop,
        exportTranscript
    };
};