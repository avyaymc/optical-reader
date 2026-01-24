/**
 * ROI (Region of Interest) selector for Optical Soundtrack Reader
 */

const ROISelector = {
    canvas: null,
    ctx: null,
    imageData: null,
    selectorElement: null,
    containerElement: null,

    // ROI bounds (in canvas coordinates)
    roi: { x: 0, y: 0, width: 50, height: 200 },

    // Drag state
    isDragging: false,
    isResizing: false,
    activeHandle: null,
    dragStart: { x: 0, y: 0 },
    roiStart: { x: 0, y: 0, width: 0, height: 0 },

    /**
     * Initialize the ROI selector
     */
    initROISelector(canvas, imageData, selectorElement, containerElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.imageData = Utils.scaleImageIfNeeded(imageData);
        this.selectorElement = selectorElement;
        this.containerElement = containerElement;

        // Set canvas size to match image
        this.canvas.width = this.imageData.width;
        this.canvas.height = this.imageData.height;

        // Draw the image
        this.ctx.putImageData(this.imageData, 0, 0);

        // Initialize ROI to left 15% of image
        this.roi = {
            x: Math.floor(this.imageData.width * 0.05),
            y: Math.floor(this.imageData.height * 0.1),
            width: Math.floor(this.imageData.width * 0.12),
            height: Math.floor(this.imageData.height * 0.8)
        };

        // Update selector position
        this.updateSelectorPosition();

        // Set up event listeners
        this.setupEventListeners();
    },

    /**
     * Update the visual selector element position
     */
    updateSelectorPosition() {
        if (!this.selectorElement || !this.canvas) return;

        // Get the displayed size of the canvas
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;

        // Position the selector in screen coordinates
        this.selectorElement.style.left = `${this.roi.x * scaleX}px`;
        this.selectorElement.style.top = `${this.roi.y * scaleY}px`;
        this.selectorElement.style.width = `${this.roi.width * scaleX}px`;
        this.selectorElement.style.height = `${this.roi.height * scaleY}px`;
    },

    /**
     * Set up mouse and touch event listeners
     */
    setupEventListeners() {
        const selector = this.selectorElement;
        const handles = selector.querySelectorAll('.roi-handle');

        // Handle resize from corners
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => this.startResize(e));
            handle.addEventListener('touchstart', (e) => this.startResize(e), { passive: false });
        });

        // Handle drag on selector body
        selector.addEventListener('mousedown', (e) => {
            if (!e.target.classList.contains('roi-handle')) {
                this.startDrag(e);
            }
        });
        selector.addEventListener('touchstart', (e) => {
            if (!e.target.classList.contains('roi-handle')) {
                this.startDrag(e);
            }
        }, { passive: false });

        // Global move and end handlers
        document.addEventListener('mousemove', (e) => this.handleMove(e));
        document.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        document.addEventListener('mouseup', () => this.endInteraction());
        document.addEventListener('touchend', () => this.endInteraction());

        // Update position on window resize
        window.addEventListener('resize', Utils.debounce(() => {
            this.updateSelectorPosition();
        }, 100));
    },

    /**
     * Start dragging the selector
     */
    startDrag(e) {
        e.preventDefault();
        this.isDragging = true;
        this.isResizing = false;

        const coords = Utils.getEventCoords(e);
        this.dragStart = { x: coords.x, y: coords.y };
        this.roiStart = { ...this.roi };
    },

    /**
     * Start resizing from a corner handle
     */
    startResize(e) {
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;
        this.isDragging = false;
        this.activeHandle = e.target.dataset.handle;

        const coords = Utils.getEventCoords(e);
        this.dragStart = { x: coords.x, y: coords.y };
        this.roiStart = { ...this.roi };
    },

    /**
     * Handle mouse/touch move
     */
    handleMove(e) {
        if (!this.isDragging && !this.isResizing) return;
        e.preventDefault();

        const coords = Utils.getEventCoords(e);
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const dx = (coords.x - this.dragStart.x) * scaleX;
        const dy = (coords.y - this.dragStart.y) * scaleY;

        if (this.isDragging) {
            // Move the entire selector
            this.roi.x = Utils.clamp(
                this.roiStart.x + dx,
                0,
                this.canvas.width - this.roi.width
            );
            this.roi.y = Utils.clamp(
                this.roiStart.y + dy,
                0,
                this.canvas.height - this.roi.height
            );
        } else if (this.isResizing) {
            // Resize from corner
            const minSize = 20;

            switch (this.activeHandle) {
                case 'tl': // Top-left
                    this.roi.x = Utils.clamp(
                        this.roiStart.x + dx,
                        0,
                        this.roiStart.x + this.roiStart.width - minSize
                    );
                    this.roi.y = Utils.clamp(
                        this.roiStart.y + dy,
                        0,
                        this.roiStart.y + this.roiStart.height - minSize
                    );
                    this.roi.width = this.roiStart.width - (this.roi.x - this.roiStart.x);
                    this.roi.height = this.roiStart.height - (this.roi.y - this.roiStart.y);
                    break;

                case 'tr': // Top-right
                    this.roi.y = Utils.clamp(
                        this.roiStart.y + dy,
                        0,
                        this.roiStart.y + this.roiStart.height - minSize
                    );
                    this.roi.width = Utils.clamp(
                        this.roiStart.width + dx,
                        minSize,
                        this.canvas.width - this.roiStart.x
                    );
                    this.roi.height = this.roiStart.height - (this.roi.y - this.roiStart.y);
                    break;

                case 'bl': // Bottom-left
                    this.roi.x = Utils.clamp(
                        this.roiStart.x + dx,
                        0,
                        this.roiStart.x + this.roiStart.width - minSize
                    );
                    this.roi.width = this.roiStart.width - (this.roi.x - this.roiStart.x);
                    this.roi.height = Utils.clamp(
                        this.roiStart.height + dy,
                        minSize,
                        this.canvas.height - this.roiStart.y
                    );
                    break;

                case 'br': // Bottom-right
                    this.roi.width = Utils.clamp(
                        this.roiStart.width + dx,
                        minSize,
                        this.canvas.width - this.roiStart.x
                    );
                    this.roi.height = Utils.clamp(
                        this.roiStart.height + dy,
                        minSize,
                        this.canvas.height - this.roiStart.y
                    );
                    break;
            }
        }

        this.updateSelectorPosition();
    },

    /**
     * End drag or resize interaction
     */
    endInteraction() {
        this.isDragging = false;
        this.isResizing = false;
        this.activeHandle = null;
    },

    /**
     * Get current ROI bounds in image coordinates
     */
    getROIBounds() {
        return {
            x: Math.floor(this.roi.x),
            y: Math.floor(this.roi.y),
            width: Math.floor(this.roi.width),
            height: Math.floor(this.roi.height)
        };
    },

    /**
     * Get the image data for extraction
     */
    getImageData() {
        return this.imageData;
    },

    /**
     * Reset the selector
     */
    reset() {
        this.isDragging = false;
        this.isResizing = false;
        this.activeHandle = null;
        this.imageData = null;
    }
};

// Make ROISelector available globally
window.ROISelector = ROISelector;
