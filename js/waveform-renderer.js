/**
 * Waveform visualization for Optical Soundtrack Reader
 */

const WaveformRenderer = {
    canvas: null,
    ctx: null,
    waveformData: null,
    animationId: null,
    playheadPosition: 0,
    isAnimating: false,
    gradientMode: false,

    // Colors (matching CSS variables)
    colors: {
        background: '#1a1a1a',
        waveform: '#4a9eff',
        waveformGradient: '#ffffff',
        playhead: '#4a9eff',
        centerLine: '#333'
    },

    /**
     * Initialize the waveform canvas
     */
    initWaveformCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Set canvas size based on container
        this.resizeCanvas();

        // Handle resize
        window.addEventListener('resize', Utils.debounce(() => {
            this.resizeCanvas();
            if (this.waveformData) {
                this.drawWaveform(this.waveformData);
            }
        }, 100));
    },

    /**
     * Resize canvas to match display size
     */
    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.ctx.scale(dpr, dpr);

        // Store display dimensions
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
    },

    /**
     * Draw the waveform
     */
    drawWaveform(waveformData) {
        this.waveformData = waveformData;

        const ctx = this.ctx;
        const width = this.displayWidth;
        const height = this.displayHeight;
        const centerY = height / 2;

        // Clear canvas
        ctx.fillStyle = this.gradientMode ? 'transparent' : this.colors.background;
        ctx.fillRect(0, 0, width, height);

        // Draw center line
        ctx.strokeStyle = this.colors.centerLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Draw waveform
        const waveformColor = this.gradientMode ? this.colors.waveformGradient : this.colors.waveform;
        ctx.strokeStyle = waveformColor;
        ctx.lineWidth = 1;

        const dataLength = waveformData.length;
        const step = width / dataLength;

        for (let i = 0; i < dataLength; i++) {
            const x = i * step;
            const amplitude = waveformData[i];
            const lineHeight = amplitude * (height / 2) * 0.9; // 90% of half-height max

            ctx.beginPath();
            ctx.moveTo(x, centerY - lineHeight);
            ctx.lineTo(x, centerY + lineHeight);
            ctx.stroke();
        }

        // Draw playhead if animating
        if (this.isAnimating) {
            this.drawPlayhead();
        }
    },

    /**
     * Draw the playhead indicator
     */
    drawPlayhead() {
        const ctx = this.ctx;
        const x = this.playheadPosition * this.displayWidth;

        ctx.strokeStyle = this.colors.playhead;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.displayHeight);
        ctx.stroke();

        // Draw a small triangle at top
        ctx.fillStyle = this.colors.playhead;
        ctx.beginPath();
        ctx.moveTo(x - 6, 0);
        ctx.lineTo(x + 6, 0);
        ctx.lineTo(x, 8);
        ctx.closePath();
        ctx.fill();
    },

    /**
     * Start playhead animation
     */
    startPlayheadAnimation(duration, loop = false) {
        this.isAnimating = true;
        this.playheadPosition = 0;

        const animate = () => {
            if (!this.isAnimating) return;

            // Get progress from audio engine
            this.playheadPosition = AudioEngine.getProgress();

            // Redraw waveform with playhead
            if (this.waveformData) {
                this.drawWaveform(this.waveformData);
            }

            this.animationId = requestAnimationFrame(animate);
        };

        animate();
    },

    /**
     * Stop playhead animation
     */
    stopPlayheadAnimation() {
        this.isAnimating = false;
        this.playheadPosition = 0;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Redraw without playhead
        if (this.waveformData) {
            this.drawWaveform(this.waveformData);
        }
    },

    /**
     * Set gradient mode for shake easter egg
     */
    setGradientMode(enabled) {
        this.gradientMode = enabled;

        if (this.waveformData) {
            this.drawWaveform(this.waveformData);
        }
    },

    /**
     * Reset renderer state
     */
    reset() {
        this.stopPlayheadAnimation();
        this.waveformData = null;
        this.gradientMode = false;

        if (this.ctx && this.displayWidth && this.displayHeight) {
            this.ctx.fillStyle = this.colors.background;
            this.ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);
        }
    }
};

// Make WaveformRenderer available globally
window.WaveformRenderer = WaveformRenderer;
