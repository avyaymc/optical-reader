/**
 * Easter eggs for Optical Soundtrack Reader
 */

const EasterEggs = {
    // State
    motionPermissionGranted: false,
    shakeCount: 0,
    shakeTimeout: null,
    konamiIndex: 0,
    tapSequence: [],
    cinemaModeActive: false,
    projectorInterval: null,
    downloadPressStart: 0,

    // Konami code sequence (keyboard)
    konamiCode: [
        'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'KeyB', 'KeyA'
    ],

    // Tap sequence: top, top, bottom, bottom, left, right, left, right, double-tap
    // Represented as: 't', 't', 'b', 'b', 'l', 'r', 'l', 'r', 'd'
    tapSequenceTarget: ['t', 't', 'b', 'b', 'l', 'r', 'l', 'r', 'd'],

    /**
     * Initialize all easter eggs
     */
    initEasterEggs() {
        this.setupShakeDetection();
        this.setupKonamiCode();
        this.setupLongPressDownload();
    },

    /**
     * Setup shake detection for the gradient easter egg
     */
    setupShakeDetection() {
        if (typeof DeviceMotionEvent === 'undefined') {
            console.log('DeviceMotion not supported');
            return;
        }

        // Request permission on first user interaction (iOS 13+)
        const requestPermission = async () => {
            const granted = await Utils.requestMotionPermission();
            if (granted) {
                this.motionPermissionGranted = true;
                this.startMotionListener();
            }
            // Remove listener after first attempt
            document.removeEventListener('touchstart', requestPermission);
            document.removeEventListener('click', requestPermission);
        };

        document.addEventListener('touchstart', requestPermission, { once: true });
        document.addEventListener('click', requestPermission, { once: true });

        // If permission not required, start immediately
        if (typeof DeviceMotionEvent.requestPermission !== 'function') {
            this.motionPermissionGranted = true;
            this.startMotionListener();
        }
    },

    /**
     * Start listening for device motion
     */
    startMotionListener() {
        window.addEventListener('devicemotion', (e) => {
            if (!e.acceleration) return;

            const { x, y, z } = e.acceleration;
            const magnitude = Math.sqrt(x * x + y * y + z * z);

            // Detect shake (magnitude > 20 m/s²)
            if (magnitude > 20) {
                this.handleShake();
            }
        });
    },

    /**
     * Handle shake detection
     */
    handleShake() {
        this.shakeCount++;

        // Reset count after 2 seconds
        clearTimeout(this.shakeTimeout);
        this.shakeTimeout = setTimeout(() => {
            this.shakeCount = 0;
        }, 2000);

        // Trigger easter egg after 3 shakes
        if (this.shakeCount >= 3) {
            this.triggerShakeEasterEgg();
            this.shakeCount = 0;
        }
    },

    /**
     * Trigger the shake-to-reveal easter egg
     */
    triggerShakeEasterEgg() {
        const container = document.getElementById('waveformContainer');
        if (!container || !container.closest('.screen.active')) return;

        // Add gradient mode
        container.classList.add('gradient-mode');
        WaveformRenderer.setGradientMode(true);

        // Revert after 2 seconds
        setTimeout(() => {
            container.classList.remove('gradient-mode');
            WaveformRenderer.setGradientMode(false);
        }, 2000);
    },

    /**
     * Check sum of 42 easter egg
     */
    checkSumOf42(waveformData) {
        const sum = Math.round(
            waveformData.reduce((acc, val) => acc + Math.abs(val) * 100, 0)
        );

        if (sum % 1000 === 42) {
            this.triggerSumOf42EasterEgg();
            return true;
        }
        return false;
    },

    /**
     * Trigger the sum of 42 easter egg
     */
    triggerSumOf42EasterEgg() {
        const container = document.getElementById('waveformContainer');
        if (container) {
            container.classList.add('gold-border');
        }

        this.showToast('The answer to everything!', 3000);
    },

    /**
     * Setup Konami code detection
     */
    setupKonamiCode() {
        // Keyboard listener
        document.addEventListener('keydown', (e) => {
            if (e.code === this.konamiCode[this.konamiIndex]) {
                this.konamiIndex++;
                if (this.konamiIndex === this.konamiCode.length) {
                    this.activateCinemaMode();
                    this.konamiIndex = 0;
                }
            } else {
                this.konamiIndex = 0;
            }
        });

        // Tap sequence on header
        const header = document.getElementById('headerTitle');
        if (header) {
            let lastTapTime = 0;

            header.addEventListener('click', (e) => {
                const rect = header.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const now = Date.now();

                // Check for double-tap
                if (now - lastTapTime < 300) {
                    this.tapSequence.push('d');
                } else {
                    // Determine tap region
                    if (y < rect.height / 2) {
                        this.tapSequence.push('t'); // top
                    } else {
                        this.tapSequence.push('b'); // bottom
                    }

                    // Also check left/right for the l/r sequence
                    if (x < rect.width / 2) {
                        // Check if we should record 'l' instead
                        const expectedIndex = this.tapSequence.length - 1;
                        if (this.tapSequenceTarget[expectedIndex] === 'l') {
                            this.tapSequence[expectedIndex] = 'l';
                        }
                    } else {
                        const expectedIndex = this.tapSequence.length - 1;
                        if (this.tapSequenceTarget[expectedIndex] === 'r') {
                            this.tapSequence[expectedIndex] = 'r';
                        }
                    }
                }

                lastTapTime = now;

                // Limit sequence length
                if (this.tapSequence.length > this.tapSequenceTarget.length) {
                    this.tapSequence.shift();
                }

                // Check if sequence matches
                if (this.tapSequence.length === this.tapSequenceTarget.length) {
                    const matches = this.tapSequence.every(
                        (tap, i) => tap === this.tapSequenceTarget[i]
                    );
                    if (matches) {
                        this.activateCinemaMode();
                        this.tapSequence = [];
                    }
                }

                // Reset sequence after timeout
                setTimeout(() => {
                    if (Date.now() - lastTapTime > 2000) {
                        this.tapSequence = [];
                    }
                }, 2000);
            });
        }
    },

    /**
     * Activate cinema mode
     */
    activateCinemaMode() {
        if (this.cinemaModeActive) return;

        this.cinemaModeActive = true;
        document.body.classList.add('cinema-mode');
        this.showToast('Cinema Mode Activated', 3000);
    },

    /**
     * Start projector sound loop (for cinema mode during playback)
     */
    startProjectorSound() {
        if (!this.cinemaModeActive) return;

        // Play clicking sound every 42ms (approximately 24fps)
        this.projectorInterval = setInterval(() => {
            if (AudioEngine.isPlaying) {
                AudioEngine.playProjectorClick();
            }
        }, 42);
    },

    /**
     * Stop projector sound
     */
    stopProjectorSound() {
        if (this.projectorInterval) {
            clearInterval(this.projectorInterval);
            this.projectorInterval = null;
        }
    },

    /**
     * Setup long press download easter egg
     */
    setupLongPressDownload() {
        const downloadBtn = document.getElementById('downloadBtn');
        if (!downloadBtn) return;

        let pressTimer = null;
        let isLongPress = false;

        const startPress = (e) => {
            isLongPress = false;
            this.downloadPressStart = Date.now();

            pressTimer = setTimeout(() => {
                isLongPress = true;
            }, 3000);
        };

        const endPress = async (e) => {
            clearTimeout(pressTimer);

            const pressDuration = Date.now() - this.downloadPressStart;

            if (pressDuration >= 3000 && isLongPress) {
                e.preventDefault();
                e.stopPropagation();
                await this.triggerReverbDownload();
            }
            // Normal download is handled by app.js click handler
        };

        downloadBtn.addEventListener('mousedown', startPress);
        downloadBtn.addEventListener('touchstart', startPress);
        downloadBtn.addEventListener('mouseup', endPress);
        downloadBtn.addEventListener('touchend', endPress);
        downloadBtn.addEventListener('mouseleave', () => clearTimeout(pressTimer));
        downloadBtn.addEventListener('touchcancel', () => clearTimeout(pressTimer));
    },

    /**
     * Trigger reverb download easter egg
     */
    async triggerReverbDownload() {
        if (!AudioEngine.currentBuffer) return;

        this.showToast('Cinema Hall Mix applied!', 3000);

        try {
            const reverbBuffer = await AudioEngine.applyReverb(AudioEngine.currentBuffer);
            const blob = AudioEngine.encodeWAV(reverbBuffer);
            AudioEngine.downloadWAV(blob, 'cinema_hall_mix.wav');
        } catch (e) {
            console.error('Reverb processing failed:', e);
            this.showToast('Failed to apply reverb effect', 3000);
        }
    },

    /**
     * Check if long press easter egg is active
     */
    isLongPressActive() {
        return Date.now() - this.downloadPressStart >= 3000;
    },

    /**
     * Show a toast notification
     */
    showToast(message, duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        container.appendChild(toast);

        // Remove after duration
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
};

// Make EasterEggs available globally
window.EasterEggs = EasterEggs;
