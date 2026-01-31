// Minimalistic VAD based on RMS energy
class VAD {
    constructor(threshold = 0.01, silenceDuration = 800) {
        this.threshold = threshold;
        this.silenceDuration = silenceDuration;
        this.lastSpeechTime = Date.now();
        this.isSpeaking = false;
        this.silenceTimer = null;
        this.onSilence = null; // Callback
        this.onSpeechStart = null; // Callback
    }

    processAudio(buffer) {
        // Assume 16-bit PCM
        const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
        let sumSquares = 0;

        // Calculate RMS
        for (let i = 0; i < samples.length; i++) {
            // Normalize to -1.0 to 1.0 range usually implies dividing by 32768
            const val = samples[i] / 32768.0;
            sumSquares += val * val;
        }
        const rms = Math.sqrt(sumSquares / samples.length);

        if (rms > this.threshold) {
            this.lastSpeechTime = Date.now();
            if (!this.isSpeaking) {
                this.isSpeaking = true;
                if (this.onSpeechStart) this.onSpeechStart();
                // If we were waiting for silence, cancel it
                if (this.silenceTimer) {
                    clearTimeout(this.silenceTimer);
                    this.silenceTimer = null;
                }
            }
        } else {
            // Potential silence
            if (this.isSpeaking) {
                const timeSinceSpeech = Date.now() - this.lastSpeechTime;
                if (timeSinceSpeech > this.silenceDuration) {
                    // Confirmed silence
                    this.isSpeaking = false;
                    if (this.onSilence) this.onSilence();
                }
            }
        }
    }

    reset() {
        this.isSpeaking = false;
        this.lastSpeechTime = Date.now();
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }
}

module.exports = VAD;
