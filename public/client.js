const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
// const statusEl removed, using robust query in function
const transcriptEl = document.getElementById('transcript');

let audioContext;
let ws;
let processor;
let microphone;
let isRecording = false;

// Audio Queue for playback
const audioQueue = [];
let isPlaying = false;
let nextPlayTime = 0;



btnStart.onclick = start;
btnStop.onclick = stop;

async function start() {
    try {
        updateStatus('processing', "Connecting...");

        // 1. WebSocket
        ws = new WebSocket('ws://' + window.location.host);

        ws.onopen = async () => {
            updateStatus('listening', "Connected! Starting Audio...");
            await startAudio();
            updateStatus('listening', "Listening...");
            isRecording = true;
            updateButtons();
        };

        ws.onmessage = async (event) => {
            if (event.data instanceof Blob) {
                // Received Audio Binary
                const arrayBuffer = await event.data.arrayBuffer();
                playAudioChunk(arrayBuffer);
            } else {
                // Received Text JSON
                const msg = JSON.parse(event.data);
                handleMessage(msg);
            }
        };

        ws.onclose = () => {
            updateStatus('default', "Disconnected");
            stop();
        };

        ws.onerror = (e) => {
            console.error(e);
            updateStatus('default', "Error");
        };

    } catch (e) {
        alert(e.message);
    }
}

async function startAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

    // Microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone = audioContext.createMediaStreamSource(stream);

    // Processor (Downsample/convert to raw PCM)
    // ScriptProcessor is deprecated but easiest for raw PCM in older APIs. 
    // Ideally AudioWorklet, but keeping it simple for "one file".
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    microphone.connect(processor);
    processor.connect(audioContext.destination); // Needed for processing to happen

    processor.onaudioprocess = (e) => {
        if (!isRecording) return;

        const inputData = e.inputBuffer.getChannelData(0); // Float32 -1 to 1

        // Convert Float32 to Int16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(pcm16.buffer);
        }
    };
}

function stop() {
    isRecording = false;
    if (microphone) microphone.disconnect();
    if (processor) processor.disconnect();
    if (audioContext) audioContext.close();
    if (ws) ws.close();
    updateButtons();
    updateStatus('default', "Stopped");
}

function updateButtons() {
    btnStart.disabled = isRecording;
    btnStop.disabled = !isRecording;
}

// Enhanced UI Logic
function handleMessage(msg) {
    const transcriptEl = document.getElementById('transcript');
    const statusContainer = document.getElementById('statusContainer');
    const statusText = document.getElementById('statusText');

    if (msg.type === 'stt_partial') {
        // Handle User Partial
        // Find if there is an existing "temporary" user message
        let tempMsg = document.getElementById('temp-user-msg');
        if (!tempMsg) {
            tempMsg = document.createElement('div');
            tempMsg.id = 'temp-user-msg';
            tempMsg.className = 'message user-msg';
            tempMsg.innerHTML = '<span class="message-role">You</span><span class="content"></span>';
            transcriptEl.appendChild(tempMsg);
        }
        // Check if at bottom BEFORE updating text
        const isAtBottom = transcriptEl.scrollHeight - transcriptEl.scrollTop <= transcriptEl.clientHeight + 100;

        // Update text
        tempMsg.querySelector('.content').innerText = msg.text;

        // Scroll if we were at bottom
        if (isAtBottom) {
            requestAnimationFrame(() => {
                transcriptEl.scrollTop = transcriptEl.scrollHeight;
            });
        }

        // Visual feedback
        updateStatus('listening', 'Listening...');

    } else if (msg.type === 'status') {
        // Map backend status to UI states
        if (msg.text.includes('Speaking')) updateStatus('listening', 'User Speaking');
        else if (msg.text.includes('Processing')) updateStatus('processing', 'AI Thinking...');
        else if (msg.text.includes('Listening')) updateStatus('listening', 'Listening...');
        else updateStatus('default', msg.text);

    } else if (msg.type === 'llm_response') {
        const tempMsg = document.getElementById('temp-user-msg');
        if (tempMsg) {
            // Finalize user message (remove ID so it sticks)
            tempMsg.removeAttribute('id');
        }

        // Add AI Message
        const div = document.createElement('div');
        div.className = 'message ai-msg';
        div.innerHTML = `<span class="message-role">AI Interviewer</span>${msg.text}`;
        transcriptEl.appendChild(div);

        // Always scroll to bottom for new AI responses? Or respect manual?
        // Usually for new messages you want to see them. Let's force scroll for new AI messages,
        // but respect it for partials. Or just use smart scroll for both.
        // User said: "auto scrolling should be there along wiht manual"
        // Let's force scroll on NEW message completions to ensure they see it, 
        // but use smart scroll for streaming partials.
        // Always force scroll for new AI messages to ensure visibility
        requestAnimationFrame(() => {
            transcriptEl.scrollTop = transcriptEl.scrollHeight;
        });

        updateStatus('speaking', 'AI Speaking');

        // After delay, back to listening (handled by backend 'listening' event usually, but fallback here)
        setTimeout(() => updateStatus('listening', 'Listening...'), 5000);
    }
}

function updateStatus(state, text) {
    const container = document.getElementById('statusContainer');
    const statusTextEl = document.getElementById('statusText');

    // Reset classes
    container.className = '';

    if (state === 'listening') container.classList.add('status-listening');
    else if (state === 'processing') container.classList.add('status-processing');
    else if (state === 'speaking') container.classList.add('status-speaking');

    if (text) statusTextEl.innerText = text;
}

// Simple Audio Playback Queue specific to 16-bit PCM Linear Raw @ 16kHz
function playAudioChunk(arrayBuffer) {
    // 16kHz raw PCM
    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);

    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
    }

    const buffer = audioContext.createBuffer(1, float32.length, 16000);
    buffer.getChannelData(0).set(float32);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    // Timing logic to play continuously
    const currentTime = audioContext.currentTime;
    if (nextPlayTime < currentTime) {
        nextPlayTime = currentTime;
    }

    source.start(nextPlayTime);
    nextPlayTime += buffer.duration;
}
