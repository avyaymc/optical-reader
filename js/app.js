/**
 * Main application controller for Optical Soundtrack Reader
 */

const App = {
    // Current state
    currentScreen: 'capture',
    capturedImageData: null,
    extractedWaveform: null,
    isPlaying: false,

    // DOM references
    elements: {},

    /**
     * Initialize the application
     */
    async init() {
        // Cache DOM elements
        this.cacheElements();

        // Register service worker
        this.registerServiceWorker();

        // Set up event listeners
        this.setupEventListeners();

        // Initialize easter eggs
        EasterEggs.initEasterEggs();

        // Initialize camera
        await this.initializeCamera();

        // Show capture screen
        this.showScreen('capture');
    },

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Screens
            captureScreen: document.getElementById('captureScreen'),
            processScreen: document.getElementById('processScreen'),
            playbackScreen: document.getElementById('playbackScreen'),

            // Capture screen
            cameraFeed: document.getElementById('cameraFeed'),
            torchBtn: document.getElementById('torchBtn'),
            captureBtn: document.getElementById('captureBtn'),
            uploadBtn: document.getElementById('uploadBtn'),
            fileInput: document.getElementById('fileInput'),

            // Process screen
            imageCanvas: document.getElementById('imageCanvas'),
            roiSelector: document.getElementById('roiSelector'),
            retakeBtn: document.getElementById('retakeBtn'),
            extractBtn: document.getElementById('extractBtn'),
            loadingOverlay: document.getElementById('loadingOverlay'),

            // Playback screen
            waveformCanvas: document.getElementById('waveformCanvas'),
            waveformContainer: document.getElementById('waveformContainer'),
            playBtn: document.getElementById('playBtn'),
            speedSlider: document.getElementById('speedSlider'),
            speedValue: document.getElementById('speedValue'),
            loopToggle: document.getElementById('loopToggle'),
            downloadBtn: document.getElementById('downloadBtn'),
            scanAnotherBtn: document.getElementById('scanAnotherBtn'),
            audioInfo: document.getElementById('audioInfo'),

            // Modal
            aboutBtn: document.getElementById('aboutBtn'),
            aboutModal: document.getElementById('aboutModal'),
            modalCloseBtn: document.getElementById('modalCloseBtn'),
            modalDismissBtn: document.getElementById('modalDismissBtn'),

            // Error display
            errorBanner: document.getElementById('errorBanner'),
            errorMessage: document.getElementById('errorMessage'),
            errorDismiss: document.getElementById('errorDismiss')
        };
    },

    /**
     * Register service worker for offline support
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered');
            } catch (error) {
                console.warn('Service Worker registration failed:', error);
            }
        }
    },

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Capture screen
        this.elements.torchBtn.addEventListener('click', () => this.toggleTorch());
        this.elements.captureBtn.addEventListener('click', () => this.capturePhoto());
        this.elements.uploadBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Process screen
        this.elements.retakeBtn.addEventListener('click', () => this.retake());
        this.elements.extractBtn.addEventListener('click', () => this.extractWaveform());

        // Playback screen
        this.elements.playBtn.addEventListener('click', () => this.togglePlayback());
        this.elements.speedSlider.addEventListener('input', (e) => this.updateSpeed(e.target.value));
        this.elements.loopToggle.addEventListener('change', (e) => this.updateLoop(e.target.checked));
        this.elements.downloadBtn.addEventListener('click', (e) => this.downloadAudio(e));
        this.elements.scanAnotherBtn.addEventListener('click', () => this.scanAnother());

        // Modal
        this.elements.aboutBtn.addEventListener('click', () => this.showModal());
        this.elements.modalCloseBtn.addEventListener('click', () => this.hideModal());
        this.elements.modalDismissBtn.addEventListener('click', () => this.hideModal());
        this.elements.aboutModal.addEventListener('click', (e) => {
            if (e.target === this.elements.aboutModal) this.hideModal();
        });

        // Error dismiss
        this.elements.errorDismiss.addEventListener('click', () => this.hideError());

        // Handle visibility change to pause audio
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isPlaying) {
                this.stopPlayback();
            }
        });
    },

    /**
     * Initialize camera
     */
    async initializeCamera() {
        const result = await Camera.initCamera(this.elements.cameraFeed);

        if (!result.success) {
            this.showError(result.error);
            // Highlight upload button as alternative
            this.elements.uploadBtn.style.animation = 'pulse 1s ease infinite';
            return;
        }

        // Show torch button if supported
        if (result.torchSupported) {
            this.elements.torchBtn.style.display = 'flex';
        }
    },

    /**
     * Show a specific screen
     */
    showScreen(screenName) {
        // Hide all screens
        ['captureScreen', 'processScreen', 'playbackScreen'].forEach(screen => {
            this.elements[screen].classList.remove('active');
        });

        // Show target screen
        const targetScreen = `${screenName}Screen`;
        this.elements[targetScreen].classList.add('active');

        this.currentScreen = screenName;

        // Handle screen-specific actions
        if (screenName === 'capture') {
            this.initializeCamera();
        } else if (screenName === 'playback') {
            WaveformRenderer.initWaveformCanvas(this.elements.waveformCanvas);
            if (this.extractedWaveform) {
                WaveformRenderer.drawWaveform(this.extractedWaveform);
            }
        }
    },

    /**
     * Toggle flashlight
     */
    async toggleTorch() {
        const isOn = await Camera.toggleTorch();
        this.elements.torchBtn.classList.toggle('active', isOn);
    },

    /**
     * Capture photo from camera
     */
    capturePhoto() {
        const imageData = Camera.captureFrame();

        if (!imageData) {
            this.showError('Failed to capture photo. Please try again.');
            return;
        }

        this.capturedImageData = imageData;
        Camera.stopCamera();

        // Initialize ROI selector on process screen
        ROISelector.initROISelector(
            this.elements.imageCanvas,
            this.capturedImageData,
            this.elements.roiSelector,
            this.elements.imageCanvas.parentElement
        );

        this.showScreen('process');
    },

    /**
     * Handle file upload
     */
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.capturedImageData = await Camera.handleFileUpload(file);
            Camera.stopCamera();

            // Initialize ROI selector
            ROISelector.initROISelector(
                this.elements.imageCanvas,
                this.capturedImageData,
                this.elements.roiSelector,
                this.elements.imageCanvas.parentElement
            );

            this.showScreen('process');
        } catch (error) {
            this.showError(error.message);
        }

        // Reset file input
        event.target.value = '';
    },

    /**
     * Go back to capture screen
     */
    retake() {
        ROISelector.reset();
        this.capturedImageData = null;
        this.showScreen('capture');
    },

    /**
     * Extract waveform from selected ROI
     */
    async extractWaveform() {
        const bounds = ROISelector.getROIBounds();
        const imageData = ROISelector.getImageData();

        // Validate ROI size
        if (bounds.width < 20 || bounds.height < 20) {
            this.showError('Please select a larger region. The selection should cover the full height of the optical track.');
            return;
        }

        // Show loading overlay
        this.elements.loadingOverlay.classList.add('active');

        // Use setTimeout to allow UI to update
        setTimeout(() => {
            try {
                this.extractedWaveform = ImageProcessor.extractWaveform(imageData, bounds);

                // Check for sum of 42 easter egg
                EasterEggs.checkSumOf42(this.extractedWaveform);

                // Create audio buffer
                AudioEngine.createAudioBuffer(this.extractedWaveform);

                // Update audio info
                const duration = AudioEngine.getDuration();
                const samples = AudioEngine.getSampleCount();
                this.elements.audioInfo.textContent =
                    `Duration: ${Utils.formatDuration(duration)} | Samples: ${samples}`;

                // Hide loading and show playback screen
                this.elements.loadingOverlay.classList.remove('active');
                this.showScreen('playback');

            } catch (error) {
                this.elements.loadingOverlay.classList.remove('active');

                if (error.message === 'ROI_TOO_SMALL') {
                    this.showError('Please select a larger region. The selection should cover the full height of the optical track.');
                } else if (error.message === 'NO_VARIATION') {
                    this.showError('The selected region appears blank. This might be a silent section of film, or the track wasn\'t captured clearly.');
                } else {
                    this.showError('Couldn\'t detect audio in the selected region. Try adjusting your selection to better align with the optical track, or ensure the film is evenly backlit.');
                }
            }
        }, 50);
    },

    /**
     * Toggle audio playback
     */
    async togglePlayback() {
        if (this.isPlaying) {
            this.stopPlayback();
        } else {
            await this.startPlayback();
        }
    },

    /**
     * Start audio playback
     */
    async startPlayback() {
        const speed = parseFloat(this.elements.speedSlider.value);
        const loop = this.elements.loopToggle.checked;

        try {
            await AudioEngine.play(null, speed, loop);
            this.isPlaying = true;

            // Update UI
            this.elements.playBtn.querySelector('.play-icon').style.display = 'none';
            this.elements.playBtn.querySelector('.pause-icon').style.display = 'block';

            // Start waveform animation
            WaveformRenderer.startPlayheadAnimation(AudioEngine.getDuration(), loop);

            // Start projector sound if in cinema mode
            EasterEggs.startProjectorSound();

            // Handle playback end
            if (!loop) {
                const duration = AudioEngine.getDuration() / speed;
                setTimeout(() => {
                    if (this.isPlaying && !this.elements.loopToggle.checked) {
                        this.stopPlayback();
                    }
                }, duration + 50);
            }
        } catch (error) {
            this.showError('Your browser doesn\'t support audio playback. Try using Safari or Chrome.');
        }
    },

    /**
     * Stop audio playback
     */
    stopPlayback() {
        AudioEngine.stop();
        this.isPlaying = false;

        // Update UI
        this.elements.playBtn.querySelector('.play-icon').style.display = 'block';
        this.elements.playBtn.querySelector('.pause-icon').style.display = 'none';

        // Stop waveform animation
        WaveformRenderer.stopPlayheadAnimation();

        // Stop projector sound
        EasterEggs.stopProjectorSound();
    },

    /**
     * Update playback speed
     */
    updateSpeed(value) {
        const speed = parseFloat(value);
        this.elements.speedValue.textContent = `${speed.toFixed(2)}x`;
        AudioEngine.setSpeed(speed);
    },

    /**
     * Update loop setting
     */
    updateLoop(enabled) {
        AudioEngine.setLoop(enabled);
    },

    /**
     * Download audio as WAV
     */
    downloadAudio(event) {
        // Check if long press easter egg is active (handled by EasterEggs module)
        if (EasterEggs.isLongPressActive()) {
            return; // Let easter egg handle it
        }

        if (!AudioEngine.currentBuffer) {
            this.showError('No audio to download');
            return;
        }

        const blob = AudioEngine.encodeWAV(AudioEngine.currentBuffer);
        AudioEngine.downloadWAV(blob, 'optical_audio.wav');
    },

    /**
     * Start a new scan
     */
    scanAnother() {
        this.stopPlayback();
        AudioEngine.stop();
        WaveformRenderer.reset();
        ROISelector.reset();
        this.capturedImageData = null;
        this.extractedWaveform = null;

        // Reset playback controls
        this.elements.speedSlider.value = 1;
        this.elements.speedValue.textContent = '1.0x';
        this.elements.loopToggle.checked = false;

        this.showScreen('capture');
    },

    /**
     * Show the about modal
     */
    showModal() {
        this.elements.aboutModal.classList.add('active');
    },

    /**
     * Hide the about modal
     */
    hideModal() {
        this.elements.aboutModal.classList.remove('active');
    },

    /**
     * Show an error message
     */
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorBanner.classList.add('active');

        // Auto-hide after 8 seconds
        setTimeout(() => this.hideError(), 8000);
    },

    /**
     * Hide the error message
     */
    hideError() {
        this.elements.errorBanner.classList.remove('active');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Make App available globally for debugging
window.App = App;
