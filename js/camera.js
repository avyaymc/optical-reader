/**
 * Camera management module for Optical Soundtrack Reader
 */

const Camera = {
    videoElement: null,
    stream: null,
    torchEnabled: false,
    torchSupported: false,

    /**
     * Initialize camera with rear-facing preference
     */
    async initCamera(videoElement) {
        this.videoElement = videoElement;

        const constraints = {
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;

            // Check for torch support
            const track = this.stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            this.torchSupported = capabilities.torch === true;

            return { success: true, torchSupported: this.torchSupported };
        } catch (error) {
            console.error('Camera init error:', error);
            return { success: false, error: this.getCameraErrorMessage(error) };
        }
    },

    /**
     * Get user-friendly camera error message
     */
    getCameraErrorMessage(error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            return 'Camera access is required to photograph film frames. Please allow camera access in your browser settings.';
        }
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            return 'No camera detected. You can upload an image instead.';
        }
        if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            return 'Camera is being used by another app. Please close other camera apps and try again.';
        }
        return 'Unable to access camera. Please try again or upload an image.';
    },

    /**
     * Toggle flashlight/torch
     */
    async toggleTorch() {
        if (!this.torchSupported || !this.stream) {
            return false;
        }

        const track = this.stream.getVideoTracks()[0];
        this.torchEnabled = !this.torchEnabled;

        try {
            await track.applyConstraints({
                advanced: [{ torch: this.torchEnabled }]
            });
            return this.torchEnabled;
        } catch (e) {
            console.warn('Failed to toggle torch:', e);
            this.torchEnabled = false;
            return false;
        }
    },

    /**
     * Capture current video frame
     */
    captureFrame() {
        if (!this.videoElement || !this.stream) {
            return null;
        }

        const video = this.videoElement;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    },

    /**
     * Stop camera stream
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        this.torchEnabled = false;
    },

    /**
     * Handle file upload and return ImageData
     */
    handleFileUpload(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('Invalid file type. Please select an image file.'));
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    resolve(imageData);
                };

                img.onerror = () => {
                    reject(new Error('Failed to load image. Please try another file.'));
                };

                img.src = e.target.result;
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file. Please try again.'));
            };

            reader.readAsDataURL(file);
        });
    },

    /**
     * Check if camera is active
     */
    isActive() {
        return this.stream !== null && this.stream.active;
    }
};

// Make Camera available globally
window.Camera = Camera;
