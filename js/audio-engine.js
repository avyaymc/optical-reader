/**
 * Audio synthesis and playback for Optical Soundtrack Reader
 */

const AudioEngine = {
    audioContext: null,
    currentSource: null,
    currentBuffer: null,
    startTime: 0,
    pauseTime: 0,
    isPlaying: false,

    /**
     * Get or create AudioContext (lazy initialization)
     */
    getContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    },

    /**
     * Resume AudioContext if suspended (autoplay policy)
     */
    async ensureContextRunning() {
        const ctx = this.getContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        return ctx;
    },

    /**
     * Create AudioBuffer from waveform data
     * Resamples to match 1/24 second at 44.1kHz (1837 samples)
     */
    createAudioBuffer(waveformData) {
        const ctx = this.getContext();
        const targetSamples = 1837; // 44100 / 24 ≈ 1837.5
        const sampleRate = 44100;

        // Create the buffer
        const buffer = ctx.createBuffer(1, targetSamples, sampleRate);
        const channelData = buffer.getChannelData(0);

        // Resample using linear interpolation
        const sourceLength = waveformData.length;

        for (let i = 0; i < targetSamples; i++) {
            // Map target index to source index
            const sourceIndex = (i / targetSamples) * sourceLength;
            const index0 = Math.floor(sourceIndex);
            const index1 = Math.min(index0 + 1, sourceLength - 1);
            const t = sourceIndex - index0;

            // Linear interpolation
            channelData[i] = Utils.lerp(waveformData[index0], waveformData[index1], t);
        }

        this.currentBuffer = buffer;
        return buffer;
    },

    /**
     * Play audio buffer
     */
    async play(audioBuffer, speed = 1, loop = false) {
        const ctx = await this.ensureContextRunning();

        // Stop any current playback
        this.stop();

        // Create and configure source
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer || this.currentBuffer;
        source.playbackRate.value = speed;
        source.loop = loop;

        source.connect(ctx.destination);

        this.currentSource = source;
        this.startTime = ctx.currentTime;
        this.isPlaying = true;

        source.onended = () => {
            if (!source.loop) {
                this.isPlaying = false;
            }
        };

        source.start(0);
        return source;
    },

    /**
     * Stop current playback
     */
    stop() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.currentSource = null;
        }
        this.isPlaying = false;
    },

    /**
     * Update playback speed
     */
    setSpeed(speed) {
        if (this.currentSource) {
            this.currentSource.playbackRate.value = speed;
        }
    },

    /**
     * Update loop setting
     */
    setLoop(loop) {
        if (this.currentSource) {
            this.currentSource.loop = loop;
        }
    },

    /**
     * Get current playback progress (0 to 1)
     */
    getProgress() {
        if (!this.isPlaying || !this.currentBuffer || !this.audioContext) {
            return 0;
        }

        const elapsed = this.audioContext.currentTime - this.startTime;
        const speed = this.currentSource ? this.currentSource.playbackRate.value : 1;
        const duration = this.currentBuffer.duration / speed;

        if (this.currentSource && this.currentSource.loop) {
            return (elapsed * speed) % this.currentBuffer.duration / this.currentBuffer.duration;
        }

        return Math.min(1, elapsed / duration);
    },

    /**
     * Get buffer duration in milliseconds
     */
    getDuration() {
        if (!this.currentBuffer) return 0;
        return this.currentBuffer.duration * 1000;
    },

    /**
     * Get sample count
     */
    getSampleCount() {
        if (!this.currentBuffer) return 0;
        return this.currentBuffer.length;
    },

    /**
     * Encode AudioBuffer to WAV Blob
     */
    encodeWAV(audioBuffer) {
        const numChannels = 1;
        const sampleRate = audioBuffer.sampleRate;
        const samples = audioBuffer.getChannelData(0);
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        function writeString(offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples.length * 2, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    },

    /**
     * Apply reverb effect to audio buffer
     */
    async applyReverb(audioBuffer) {
        const ctx = this.getContext();
        const duration = 0.5; // 0.5 second reverb tail
        const sampleRate = ctx.sampleRate;
        const length = Math.floor(duration * sampleRate);

        // Create impulse response (exponential decay)
        const impulseBuffer = ctx.createBuffer(1, length, sampleRate);
        const impulseData = impulseBuffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            // Exponential decay with some noise
            const decay = Math.exp(-3 * i / length);
            impulseData[i] = (Math.random() * 2 - 1) * decay;
        }

        // Create offline context to process
        const offlineCtx = new OfflineAudioContext(
            1,
            audioBuffer.length + length,
            sampleRate
        );

        // Create source
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;

        // Create convolver
        const convolver = offlineCtx.createConvolver();
        convolver.buffer = impulseBuffer;

        // Create dry/wet mix
        const dryGain = offlineCtx.createGain();
        const wetGain = offlineCtx.createGain();
        dryGain.gain.value = 0.7;
        wetGain.gain.value = 0.5;

        // Connect: source -> dry gain -> destination
        //          source -> convolver -> wet gain -> destination
        source.connect(dryGain);
        dryGain.connect(offlineCtx.destination);

        source.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(offlineCtx.destination);

        source.start(0);

        return await offlineCtx.startRendering();
    },

    /**
     * Download a WAV file
     */
    downloadWAV(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Generate projector click sound as base64
     */
    generateProjectorClick() {
        const ctx = this.getContext();
        const duration = 0.15;
        const sampleRate = ctx.sampleRate;
        const length = Math.floor(duration * sampleRate);

        const buffer = ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        // Generate click: burst of filtered noise with fast attack/decay
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            // Fast attack (5ms), exponential decay
            const envelope = t < 0.005
                ? t / 0.005
                : Math.exp(-30 * (t - 0.005));

            // Noise with some low-pass filtering effect
            data[i] = (Math.random() * 2 - 1) * envelope * 0.3;

            // Add a sharp transient at the start
            if (t < 0.002) {
                data[i] += Math.sin(t * 4000 * Math.PI) * (1 - t / 0.002) * 0.5;
            }
        }

        return buffer;
    },

    /**
     * Play projector click sound
     */
    async playProjectorClick() {
        const ctx = await this.ensureContextRunning();
        const clickBuffer = this.generateProjectorClick();

        const source = ctx.createBufferSource();
        source.buffer = clickBuffer;

        const gain = ctx.createGain();
        gain.gain.value = 0.3;

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);

        return source;
    }
};

// Make AudioEngine available globally
window.AudioEngine = AudioEngine;
