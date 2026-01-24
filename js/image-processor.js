/**
 * Image processing and waveform extraction for Optical Soundtrack Reader
 */

const ImageProcessor = {
    /**
     * Main extraction function - extract waveform from image
     */
    extractWaveform(imageData, roiBounds) {
        // Validate ROI bounds
        if (roiBounds.width < 20 || roiBounds.height < 20) {
            throw new Error('ROI_TOO_SMALL');
        }

        // Crop to ROI
        const roiData = this.cropToROI(imageData, roiBounds);

        // Convert to grayscale
        const grayscale = this.toGrayscale(roiData);

        // Apply contrast stretching
        const enhanced = this.stretchContrast(grayscale);

        // Optional: apply light blur to reduce noise
        const smoothed = this.boxBlur(enhanced, roiBounds.width, roiBounds.height, 3);

        // Calculate threshold using Otsu's method
        const threshold = this.otsuThreshold(smoothed);

        // Extract waveform by finding light/dark boundary for each row
        const rawWaveform = this.findBoundaries(smoothed, roiBounds.width, roiBounds.height, threshold);

        // Check if we got meaningful data
        const stdDev = this.standardDeviation(rawWaveform);
        if (stdDev < 0.01) {
            throw new Error('NO_VARIATION');
        }

        // Normalize to [-1, 1] range
        const normalized = this.normalizeWaveform(rawWaveform);

        // Remove DC offset
        const dcRemoved = this.removeDCOffset(normalized);

        // Apply smoothing
        const finalWaveform = this.movingAverage(dcRemoved, 5);

        return new Float32Array(finalWaveform);
    },

    /**
     * Crop image data to ROI
     */
    cropToROI(imageData, bounds) {
        const { x, y, width, height } = bounds;
        const srcData = imageData.data;
        const srcWidth = imageData.width;

        const croppedData = new Uint8ClampedArray(width * height * 4);

        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const srcIdx = ((y + row) * srcWidth + (x + col)) * 4;
                const destIdx = (row * width + col) * 4;

                croppedData[destIdx] = srcData[srcIdx];         // R
                croppedData[destIdx + 1] = srcData[srcIdx + 1]; // G
                croppedData[destIdx + 2] = srcData[srcIdx + 2]; // B
                croppedData[destIdx + 3] = srcData[srcIdx + 3]; // A
            }
        }

        return croppedData;
    },

    /**
     * Convert RGBA data to grayscale array
     */
    toGrayscale(rgbaData) {
        const length = rgbaData.length / 4;
        const grayscale = new Float32Array(length);

        for (let i = 0; i < length; i++) {
            const idx = i * 4;
            // Luminance formula: 0.299*R + 0.587*G + 0.114*B
            grayscale[i] = 0.299 * rgbaData[idx] +
                0.587 * rgbaData[idx + 1] +
                0.114 * rgbaData[idx + 2];
        }

        return grayscale;
    },

    /**
     * Apply contrast stretching to grayscale data
     */
    stretchContrast(grayscale) {
        let min = Infinity;
        let max = -Infinity;

        // Find min and max values
        for (let i = 0; i < grayscale.length; i++) {
            if (grayscale[i] < min) min = grayscale[i];
            if (grayscale[i] > max) max = grayscale[i];
        }

        const range = max - min;
        if (range === 0) return grayscale;

        // Stretch to 0-255 range
        const stretched = new Float32Array(grayscale.length);
        for (let i = 0; i < grayscale.length; i++) {
            stretched[i] = ((grayscale[i] - min) / range) * 255;
        }

        return stretched;
    },

    /**
     * Apply box blur to reduce noise
     */
    boxBlur(data, width, height, radius) {
        const result = new Float32Array(data.length);
        const kernelSize = radius * 2 + 1;
        const kernelArea = kernelSize * kernelSize;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;

                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const ny = y + ky;
                        const nx = x + kx;

                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            sum += data[ny * width + nx];
                            count++;
                        }
                    }
                }

                result[y * width + x] = sum / count;
            }
        }

        return result;
    },

    /**
     * Calculate Otsu's threshold
     */
    otsuThreshold(grayscale) {
        // Build histogram (256 bins)
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < grayscale.length; i++) {
            const bin = Math.min(255, Math.max(0, Math.floor(grayscale[i])));
            histogram[bin]++;
        }

        const total = grayscale.length;
        let sum = 0;
        for (let i = 0; i < 256; i++) {
            sum += i * histogram[i];
        }

        let sumB = 0;
        let wB = 0;
        let wF = 0;
        let maxVariance = 0;
        let threshold = 0;

        for (let t = 0; t < 256; t++) {
            wB += histogram[t];
            if (wB === 0) continue;

            wF = total - wB;
            if (wF === 0) break;

            sumB += t * histogram[t];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;

            const variance = wB * wF * (mB - mF) * (mB - mF);

            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = t;
            }
        }

        return threshold;
    },

    /**
     * Find light/dark boundaries for each row
     */
    findBoundaries(data, width, height, threshold) {
        const waveform = new Float32Array(height);

        for (let y = 0; y < height; y++) {
            const rowStart = y * width;

            // Find transition points in this row
            let leftEdge = -1;
            let rightEdge = -1;

            // Scan from left to find first transition
            for (let x = 0; x < width; x++) {
                const value = data[rowStart + x];
                const isLight = value > threshold;

                if (isLight && leftEdge === -1) {
                    leftEdge = x;
                }
                if (!isLight && leftEdge !== -1 && rightEdge === -1) {
                    rightEdge = x;
                    break;
                }
            }

            // If no right edge found but left edge exists, use width
            if (leftEdge !== -1 && rightEdge === -1) {
                rightEdge = width;
            }

            // If no edges found, try the opposite (dark on light)
            if (leftEdge === -1) {
                for (let x = 0; x < width; x++) {
                    const value = data[rowStart + x];
                    const isDark = value <= threshold;

                    if (isDark && leftEdge === -1) {
                        leftEdge = x;
                    }
                    if (!isDark && leftEdge !== -1 && rightEdge === -1) {
                        rightEdge = x;
                        break;
                    }
                }
                if (leftEdge !== -1 && rightEdge === -1) {
                    rightEdge = width;
                }
            }

            // Calculate waveform value from boundary positions
            if (leftEdge !== -1 && rightEdge !== -1) {
                // Use the width of the transparent region as amplitude
                const trackWidth = rightEdge - leftEdge;
                waveform[y] = trackWidth / width;
            } else {
                // Fallback: use average brightness of the row
                let sum = 0;
                for (let x = 0; x < width; x++) {
                    sum += data[rowStart + x];
                }
                waveform[y] = (sum / width) / 255;
            }
        }

        return waveform;
    },

    /**
     * Calculate standard deviation
     */
    standardDeviation(data) {
        const n = data.length;
        if (n === 0) return 0;

        const mean = data.reduce((sum, val) => sum + val, 0) / n;
        const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n;

        return Math.sqrt(variance);
    },

    /**
     * Normalize waveform to [-1, 1] range
     */
    normalizeWaveform(data) {
        let min = Infinity;
        let max = -Infinity;

        for (let i = 0; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }

        const range = max - min;
        if (range === 0) {
            return new Float32Array(data.length).fill(0);
        }

        const normalized = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) {
            // Map to [0, 1] first, then to [-1, 1]
            normalized[i] = ((data[i] - min) / range) * 2 - 1;
        }

        return normalized;
    },

    /**
     * Remove DC offset by subtracting mean
     */
    removeDCOffset(data) {
        const mean = data.reduce((sum, val) => sum + val, 0) / data.length;

        const result = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) {
            result[i] = data[i] - mean;
        }

        return result;
    },

    /**
     * Apply moving average smoothing
     */
    movingAverage(data, windowSize) {
        const result = new Float32Array(data.length);
        const halfWindow = Math.floor(windowSize / 2);

        for (let i = 0; i < data.length; i++) {
            let sum = 0;
            let count = 0;

            for (let j = i - halfWindow; j <= i + halfWindow; j++) {
                if (j >= 0 && j < data.length) {
                    sum += data[j];
                    count++;
                }
            }

            result[i] = sum / count;
        }

        return result;
    }
};

// Make ImageProcessor available globally
window.ImageProcessor = ImageProcessor;
