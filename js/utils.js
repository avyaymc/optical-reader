/**
 * Utility functions for Optical Soundtrack Reader
 */

const Utils = {
    /**
     * Clamp a value between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * Linear interpolation between two values
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Debounce a function
     */
    debounce(fn, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /**
     * Detect if device supports touch
     */
    isTouchDevice() {
        return ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0);
    },

    /**
     * Request DeviceMotion permission on iOS 13+
     */
    async requestMotionPermission() {
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                return permission === 'granted';
            } catch (e) {
                console.warn('DeviceMotion permission request failed:', e);
                return false;
            }
        }
        // Permission not required on non-iOS or older iOS
        return true;
    },

    /**
     * Get touch or mouse coordinates from an event
     */
    getEventCoords(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    },

    /**
     * Scale image data if too large
     */
    scaleImageIfNeeded(imageData, maxDimension = 2000) {
        const { width, height } = imageData;

        if (width <= maxDimension && height <= maxDimension) {
            return imageData;
        }

        const scale = maxDimension / Math.max(width, height);
        const newWidth = Math.floor(width * scale);
        const newHeight = Math.floor(height * scale);

        // Create temporary canvases for scaling
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = width;
        srcCanvas.height = height;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.putImageData(imageData, 0, 0);

        const destCanvas = document.createElement('canvas');
        destCanvas.width = newWidth;
        destCanvas.height = newHeight;
        const destCtx = destCanvas.getContext('2d');
        destCtx.drawImage(srcCanvas, 0, 0, newWidth, newHeight);

        return destCtx.getImageData(0, 0, newWidth, newHeight);
    },

    /**
     * Generate a simple unique ID
     */
    generateId() {
        return Math.random().toString(36).substring(2, 9);
    },

    /**
     * Format duration in milliseconds to readable string
     */
    formatDuration(ms) {
        if (ms < 1000) {
            return `~${Math.round(ms)}ms`;
        }
        return `~${(ms / 1000).toFixed(2)}s`;
    }
};

// Make Utils available globally
window.Utils = Utils;
