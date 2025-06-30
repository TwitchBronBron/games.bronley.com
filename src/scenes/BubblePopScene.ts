import Phaser from 'phaser';
import { SceneName } from '../constants';
import { createColorFactory, randomInt } from '../util';
type GameObject = Phaser.GameObjects.GameObject;
type Sprite = Phaser.GameObjects.Sprite;
type Pointer = Phaser.Input.Pointer;
type Text = Phaser.GameObjects.Text;

export default class BubblePopScene extends Phaser.Scene {
    constructor() {
        super(SceneName.BubblePopScene);
    }

    /**
     * Storage keys for persisting settings
     */
    private readonly STORAGE_KEYS = {
        BUBBLE_COUNT: 'bubblePopScene_bubbleCount',
        DRAG_TO_KILL_ENABLED: 'bubblePopScene_dragToKillEnabled'
    };

    /**
     * The size of each bubble in pixels
     */
    private bubbleSize = 200;

    /**
     * Total number of bubbles in the game - when this bucket is empty, the player wins
     */
    private TOTAL_BUBBLES = 50;

    /**
     * Delay in milliseconds before a popped bubble spot gets refilled
     */
    private readonly REFILL_DELAY = 0;

    /**
     * Whether drag-to-kill mode is enabled
     */
    private dragToKillEnabled = false;

    /**
     * Flag to prevent bubble creation during reset
     */
    private isResetting = false;

    preload() {
        this.load.image('bubble', 'assets/images/bubble.png');
        this.load.image('spark', 'assets/images/particle.png');

        this.load.audio('pop', 'assets/audio/pop.mp3').once('filecomplete-audio-pop', (key: string) => {
            console.log('pop sound loaded');
            this.popSound = this.sound.add(key);
        });

        this.load.audio('victory', ['assets/audio/sparkle.mp3']).once('filecomplete-audio-victory', () => {
            console.log('victory sound loaded');
            this.victorySound = this.sound.add('victory');
        });

    } create() {
        console.log('create bubble scene');
        this.loadSettings(); // Load saved settings before creating the scene
        this.cleanupBubbles(); // Clean up any existing bubbles from previous runs
        this.addBackButton();
        this.addProgressCounter();
        this.computeSizing();
        this.createBubbleGrid();

        // Listen for resize events
        this.scale.on('resize', this.handleResize, this);

        // Set up drag-to-kill input handling
        this.setupDragToKill();
    }

    /**
     * Load settings from localStorage
     */
    private loadSettings() {
        try {
            // Load bubble count
            const savedBubbleCount = localStorage.getItem(this.STORAGE_KEYS.BUBBLE_COUNT);
            if (savedBubbleCount !== null) {
                const count = parseInt(savedBubbleCount, 10);
                if (!isNaN(count)) {
                    this.TOTAL_BUBBLES = count;
                }
            }

            // Load drag mode setting
            const savedDragMode = localStorage.getItem(this.STORAGE_KEYS.DRAG_TO_KILL_ENABLED);
            if (savedDragMode !== null) {
                this.dragToKillEnabled = savedDragMode === 'true';
            }
        } catch (error) {
            console.warn('Failed to load settings from localStorage:', error);
        }
    }

    /**
     * Save settings to localStorage
     */
    private saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.BUBBLE_COUNT, this.TOTAL_BUBBLES.toString());
            localStorage.setItem(this.STORAGE_KEYS.DRAG_TO_KILL_ENABLED, this.dragToKillEnabled.toString());
        } catch (error) {
            console.warn('Failed to save settings to localStorage:', error);
        }
    }

    private createBubbleGrid() {
        // Create the bucket of bubbles
        this.createBubbleBucket();

        // Fill the initial grid
        this.fillBubbleGrid();
    }

    private createBubbleBucket() {
        // In infinite mode, create enough bubbles to fill the screen plus extras
        let bubblesToCreate = this.TOTAL_BUBBLES;
        if (this.TOTAL_BUBBLES === -1) {
            // Calculate screen capacity considering top margin and create 2x that amount for infinite mode
            const topMargin = this.getTopMargin();
            const availableHeight = this.gameHeight - topMargin;
            const maxBubblesHoriz = Math.round(this.gameWidth / this.bubbleSize);
            const maxBubblesVert = Math.round(availableHeight / this.bubbleSize);
            const screenCapacity = maxBubblesHoriz * maxBubblesVert;
            bubblesToCreate = screenCapacity * 2; // Keep 2x screen capacity in reserve
        }

        // Create all bubbles and store them in the bucket (initially hidden)
        for (let i = 0; i < bubblesToCreate; i++) {
            const bubble = this.createBubble(0, 0);
            bubble.setVisible(false);
            bubble.setAlpha(1); // Ensure alpha is set to 1 for reuse
            bubble.x = -1000; // Move offscreen
            bubble.y = -1000;
            this.bubbleBucket.push(bubble);
        }
    }

    private fillBubbleGrid() {
        const topMargin = this.getTopMargin();
        const availableHeight = this.gameHeight - topMargin;

        const maxBubblesHoriz = Math.round(this.gameWidth / this.bubbleSize);
        const maxBubblesVert = Math.round(availableHeight / this.bubbleSize);
        const maxVisibleBubbles = maxBubblesHoriz * maxBubblesVert;

        // Check which bubbles are still within the visible area
        const bubblesStillVisible: Sprite[] = [];
        const bubblesToHide: Sprite[] = [];

        this.bubbles.forEach(bubble => {
            const col = Math.round((bubble.x - this.bubbleSize / 2) / this.bubbleSize);
            const row = Math.round((bubble.y - topMargin - this.bubbleSize / 2) / this.bubbleSize);

            // Check if this bubble position is still within the new grid bounds
            if (col >= 0 && col < maxBubblesHoriz && row >= 0 && row < maxBubblesVert) {
                bubblesStillVisible.push(bubble);
            } else {
                bubblesToHide.push(bubble);
            }
        });

        // Hide bubbles that are now offscreen and return them to bucket
        bubblesToHide.forEach(bubble => {
            bubble.setVisible(false);
            bubble.setAlpha(1); // Reset alpha for reuse
            bubble.x = -1000;
            bubble.y = -1000;
            this.bubbleBucket.push(bubble);
            this.bubbles.delete(bubble);
        });

        // Create a map of occupied positions
        const occupiedPositions = new Set<string>();
        bubblesStillVisible.forEach(bubble => {
            const col = Math.round((bubble.x - this.bubbleSize / 2) / this.bubbleSize);
            const row = Math.round((bubble.y - topMargin - this.bubbleSize / 2) / this.bubbleSize);
            occupiedPositions.add(`${row},${col}`);
        });

        // Fill empty spots with bubbles from the bucket
        const spotsToFill = maxVisibleBubbles - bubblesStillVisible.length;
        let bubblesWeCanAdd = Math.min(spotsToFill, this.bubbleBucket.length);

        // In infinite mode, if we're running low on bucket bubbles, create more
        if (this.TOTAL_BUBBLES === -1 && this.bubbleBucket.length < spotsToFill) {
            const additionalBubblesNeeded = spotsToFill - this.bubbleBucket.length;
            for (let i = 0; i < additionalBubblesNeeded; i++) {
                const bubble = this.createBubble(0, 0);
                bubble.setVisible(false);
                bubble.setAlpha(1);
                bubble.x = -1000;
                bubble.y = -1000;
                this.bubbleBucket.push(bubble);
            }
            bubblesWeCanAdd = spotsToFill; // Now we can fill all spots
        }

        let bubblesAdded = 0;
        for (let row = 0; row < maxBubblesVert && bubblesAdded < bubblesWeCanAdd; row++) {
            for (let col = 0; col < maxBubblesHoriz && bubblesAdded < bubblesWeCanAdd; col++) {
                const positionKey = `${row},${col}`;

                // If this position is empty, fill it
                if (!occupiedPositions.has(positionKey)) {
                    const bubble = this.bubbleBucket.shift()!; // Take from bucket

                    bubble.x = col * this.bubbleSize + this.bubbleSize / 2;
                    bubble.y = row * this.bubbleSize + this.bubbleSize / 2 + topMargin;
                    bubble.setVisible(true);
                    bubble.setAlpha(1); // Show immediately on game start

                    // Reset interactive state and animations immediately
                    this.resetBubbleInteractivity(bubble);

                    // Add to active bubbles set
                    this.bubbles.add(bubble);
                    bubblesAdded++;
                }
            }
        }
    }

    private handleResize() {
        // Reposition UI elements
        this.repositionProgressCounter();
        this.repositionButtons();

        // Refill the grid using the bucket system
        this.fillBubbleGrid();
    }

    /**
     * Calculate a responsive scale factor based on screen size
     * Returns a multiplier for font sizes and UI elements
     */
    private getUIScaleFactor(): number {
        // Base scale on the smaller dimension to ensure UI fits on both portrait and landscape
        const minDimension = Math.min(this.gameWidth, this.gameHeight);

        // Use 600px as our baseline - scale proportionally from there
        // This ensures buttons are readable on mobile while not being huge on desktop
        const baseSize = 600;
        const scaleFactor = Math.max(0.7, Math.min(2.0, minDimension / baseSize));

        return scaleFactor;
    }

    /**
     * Reposition and rescale buttons based on current screen size
     */
    private repositionButtons() {
        const scaleFactor = this.getUIScaleFactor();

        if (this.backButton) {
            // Scale the back button - make it larger on mobile
            const backFontSize = Math.round(60 * scaleFactor); // Increased from 48 to 60
            const backPaddingH = Math.round(25 * scaleFactor); // Increased from 20 to 25
            const backPaddingV = Math.round(12 * scaleFactor); // Increased from 10 to 12

            this.backButton.setStyle({ fontSize: `${backFontSize}px` });
            this.backButton.setPadding(backPaddingH, 0, backPaddingH, backPaddingV);
        }

        if (this.settingsButton) {
            // Scale the settings button - make it larger on mobile
            const settingsFontSize = Math.round(45 * scaleFactor); // Increased from 36 to 45
            const settingsPadding = Math.round(18 * scaleFactor); // Increased from 15 to 18
            const settingsPaddingV = Math.round(12 * scaleFactor); // Increased from 10 to 12

            // Reposition it relative to the back button
            if (this.backButton) {
                const backButtonBounds = this.backButton.getBounds();
                const settingsX = backButtonBounds.right + (Math.round(25 * scaleFactor) * 0.5); // Adjusted spacing
                const settingsY = backButtonBounds.centerY;

                this.settingsButton.setPosition(settingsX, settingsY);
            }

            this.settingsButton.setStyle({ fontSize: `${settingsFontSize}px` });
            this.settingsButton.setPadding(settingsPadding, settingsPaddingV, settingsPadding, settingsPaddingV);
        }

        if (this.progressText) {
            // Scale the progress counter
            const progressFontSize = Math.round(32 * scaleFactor);
            const progressPadding = Math.round(20 * scaleFactor);
            const progressPaddingV = Math.round(10 * scaleFactor);

            this.progressText.setStyle({ fontSize: `${progressFontSize}px` });
            this.progressText.setPadding(progressPadding, progressPaddingV, progressPadding, progressPaddingV);
        }
    }

    private fillSpecificSpot(x: number, y: number) {
        // Don't create bubbles if we're resetting
        if (this.isResetting) {
            return;
        }

        // Create a unique key for this position
        const positionKey = `${x},${y}`;

        // Don't schedule multiple refills for the same position
        if (this.pendingRefills.has(positionKey)) {
            return;
        }

        // Only schedule refill if we have bubbles in the bucket or we're in infinite mode
        if (this.bubbleBucket.length > 0 || this.TOTAL_BUBBLES === -1) {
            this.pendingRefills.add(positionKey);

            // Schedule the refill after the configured delay
            this.time.delayedCall(this.REFILL_DELAY, () => {
                // Don't create bubbles if we're resetting
                if (this.isResetting) {
                    this.pendingRefills.delete(positionKey);
                    return;
                }

                this.pendingRefills.delete(positionKey);

                // In infinite mode, create a new bubble if bucket is empty
                let bubble: Sprite;
                if (this.bubbleBucket.length > 0) {
                    bubble = this.bubbleBucket.shift()!; // Take from bucket
                } else if (this.TOTAL_BUBBLES === -1) {
                    // Create a new bubble for infinite mode when bucket is empty
                    bubble = this.createBubble(x, y);
                } else {
                    return; // No bubble available and not infinite mode
                }

                // Double-check that the spot is still empty
                if (this.isPositionEmpty(x, y)) {
                    // FIRST: Stop any existing animations on this bubble
                    this.tweens.killTweensOf(bubble);
                    if ((bubble as any).floatTween) {
                        (bubble as any).floatTween.destroy();
                        (bubble as any).floatTween = null;
                    }

                    // Position the bubble (needed for both reused and new bubbles)
                    bubble.x = x;
                    bubble.y = y;
                    bubble.setVisible(true);

                    // Add to active bubbles set immediately
                    this.bubbles.add(bubble);

                    // Set up interactivity immediately, before fade-in animation
                    this.resetBubbleInteractivity(bubble);

                    // Start with alpha 0 for fade-in animation
                    bubble.setAlpha(0);

                    // Animate the bubble fading in
                    this.tweens.add({
                        targets: bubble,
                        alpha: 1,
                        ease: 'Cubic.easeInOut',
                        duration: 1500,
                        onComplete: () => {
                            // Animation complete - bubble is now fully visible and interactive
                        }
                    });
                }
            });
        }
    }

    private isPositionEmpty(x: number, y: number): boolean {
        // Check if any active bubble is at this position (within a small tolerance)
        const tolerance = 10;
        for (const bubble of this.bubbles) {
            if (Math.abs(bubble.x - x) < tolerance && Math.abs(bubble.y - y) < tolerance) {
                return false;
            }
        }
        return true;
    }

    finalize() {
        this.victorySound?.play();
        this.addPlayAgainButton();
    }

    private cleanupBubbles(preserveSettingsPanel = false) {
        // Clear all pending refill timers first
        this.pendingRefills.clear();

        // Remove all pending time events to prevent phantom bubbles
        this.time.removeAllEvents();

        // Clean up settings panel if it's open (unless we want to preserve it)
        if (this.settingsPanelVisible && !preserveSettingsPanel) {
            this.settingsPanel?.destroy();
            this.settingsBackground?.destroy();
            this.settingsPanelVisible = false;
        }

        // Clean up all tweens and bubbles in active set
        this.bubbles.forEach(bubble => {
            this.tweens.killTweensOf(bubble);
            if ((bubble as any).floatTween) {
                (bubble as any).floatTween.destroy();
            }
            // Remove all listeners to prevent stale references
            bubble.removeAllListeners();
            bubble.destroy();
        });
        this.bubbles.clear();

        // Clean up bucket bubbles
        this.bubbleBucket.forEach(bubble => {
            this.tweens.killTweensOf(bubble);
            if ((bubble as any).floatTween) {
                (bubble as any).floatTween.destroy();
            }
            // Remove all listeners to prevent stale references
            bubble.removeAllListeners();
            bubble.destroy();
        });
        this.bubbleBucket = [];
        this.bubblesPopped = 0;

        // Clear pending refills (done above but kept for clarity)
        this.pendingRefills.clear();

        // Clean up all particle managers
        this.particleManagers.forEach(manager => {
            manager.destroy();
        });
        this.particleManagers.clear();
    }

    private backButton!: Text;
    private settingsButton!: Text;
    private progressText!: Text;
    private progressHint!: Text;
    private settingsPanel!: Phaser.GameObjects.Container;
    private settingsBackground!: Phaser.GameObjects.Rectangle;
    private settingsPanelVisible = false;

    private popSound!: Phaser.Sound.BaseSound;
    private victorySound!: Phaser.Sound.BaseSound;
    private colorFactory = createColorFactory();

    private bubbleWidth = 0;
    private bubbleHeight = 0;

    private get gameWidth() {
        return this.scale.gameSize.width;
    }
    private get gameHeight() {
        return this.scale.gameSize.height;
    }

    private bubbles = new Set<Sprite>();
    private particleManagers = new Set<Phaser.GameObjects.Particles.ParticleEmitter>();

    /**
     * The bucket of available bubbles - these are created once and reused
     */
    private bubbleBucket: Sprite[] = [];

    /**
     * Count of bubbles that have been popped (removed from the bucket permanently)
     */
    private bubblesPopped = 0;

    /**
     * Set to track delayed refill timers to prevent duplicates
     */
    private pendingRefills = new Set<string>();

    private popBubble(bubble: Sprite) {
        // Prevent multiple pops on the same bubble
        if (!this.bubbles.has(bubble)) {
            console.log('Attempted to pop bubble not in active set');
            return;
        }

        // Stop any existing tweens on this bubble to prevent conflicts
        this.tweens.killTweensOf(bubble);

        // Store the position before destroying the bubble
        const bubbleX = bubble.x;
        const bubbleY = bubble.y;

        const v = 50;
        // Use simpler particle approach similar to original
        var particleManager = this.add.particles(bubble.x, bubble.y, 'spark', {
            speed: 2000,
            quantity: 5,
            gravityY: 13000,
            scale: { min: 0.05, max: 0.1 },
            x: { min: -v, max: v },
            y: { min: -v, max: v }
        });

        // Track particle manager for cleanup
        this.particleManagers.add(particleManager);

        this.popSound?.play();

        // Remove bubble from active set and increment popped count
        this.bubbles.delete(bubble);
        this.bubblesPopped++;
        this.updateProgressCounter();

        this.tweens.add({
            targets: bubble,
            scaleX: 0,
            scaleY: 0,
            ease: 'Sine.easeInOut',
            duration: 100,
            onComplete: () => {
                bubble.destroy();

                // Stop the emitter and schedule cleanup
                particleManager.stop();

                // Clean up particle manager after particles have fallen
                this.time.delayedCall(2000, () => {
                    this.particleManagers.delete(particleManager);
                    particleManager.destroy();
                });

                // Try to fill this spot with a bubble from the bucket
                this.fillSpecificSpot(bubbleX, bubbleY);

                // Check if we've depleted the entire bucket (win condition) - but not in infinite mode
                if (this.TOTAL_BUBBLES !== -1 && this.bubblesPopped >= this.TOTAL_BUBBLES) {
                    this.finalize();
                }
            }
        })
    }

    private createBubble(x: number, y: number) {
        const bubble = this.make.sprite({
            key: 'bubble'
        });
        bubble.displayWidth = this.bubbleSize
        bubble.displayHeight = this.bubbleSize;
        bubble.setTint(this.colorFactory());
        bubble.setInteractive({
            cursor: 'pointer'
        });

        // Note: Don't add to this.bubbles set here - only add when bubble becomes active

        // Click handler will be added in resetBubbleInteractivity based on mode

        return bubble;
    }

    private computeSizing() {
        const bubble = this.createBubble(0, 0);
        this.bubbleWidth = bubble.displayWidth;
        this.bubbleHeight = bubble.displayHeight;
        bubble.destroy();
        // No need to delete from bubbles set since it was never added
    }

    private addBackButton() {
        // Use the same scaling system as repositionButtons - make buttons larger on mobile
        const scaleFactor = this.getUIScaleFactor();
        const backButtonFontSize = Math.round(60 * scaleFactor); // Increased from 48 to 60
        const backPaddingH = Math.round(25 * scaleFactor); // Increased from 20 to 25
        const backPaddingV = Math.round(12 * scaleFactor); // Increased from 10 to 12

        this.backButton = this.add.text(10, 10, '←', {
            fontSize: `${backButtonFontSize}px`,
            color: 'white'
        })
            .setOrigin(0)
            .setPadding(backPaddingH, 0, backPaddingH, backPaddingV)
            .setStyle({ backgroundColor: '#111' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
                this.scene.restart();
                this.scene.switch(SceneName.TitleScene);
            })
            .setDepth(10)
            .on('pointerover', () => this.backButton.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => this.backButton.setStyle({ fill: '#FFF' }))

        // Calculate settings button dimensions using the same scaling system - make it larger on mobile
        const settingsButtonFontSize = Math.round(45 * scaleFactor); // Increased from 36 to 45
        const settingsPadding = Math.round(18 * scaleFactor); // Increased from 15 to 18
        const settingsPaddingV = Math.round(12 * scaleFactor); // Increased from 10 to 12

        // Calculate position for settings button to be next to back button
        const backButtonBounds = this.backButton.getBounds();
        const settingsButtonX = backButtonBounds.right + (backPaddingH * 0.5);
        const settingsButtonY = backButtonBounds.centerY;

        // Add settings button next to the back button
        this.settingsButton = this.add.text(settingsButtonX, settingsButtonY, '⚙', {
            fontSize: `${settingsButtonFontSize}px`,
            color: 'white'
        })
            .setOrigin(0, 0.5) // Center vertically, align left horizontally
            .setPadding(settingsPadding, settingsPaddingV, settingsPadding, settingsPaddingV)
            .setStyle({ backgroundColor: '#333' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
                this.toggleSettingsPanel();
            })
            .setDepth(10)
            .on('pointerover', () => this.settingsButton.setStyle({ fill: '#f39c12', backgroundColor: '#555' }))
            .on('pointerout', () => this.settingsButton.setStyle({ fill: '#FFF', backgroundColor: '#333' }))
    }

    private addPlayAgainButton() {
        // Use the same scaling system as other buttons
        const scaleFactor = this.getUIScaleFactor();
        const fontSize = Math.round(48 * scaleFactor);
        const padding = Math.round(50 * scaleFactor);

        var playAgain = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Play Again', {
            fontSize: `${fontSize}px`,
            color: 'white'
        })
            .setOrigin(.5)
            .setPadding(padding)
            .setResolution(10)
            .setStyle({ backgroundColor: 'green' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
                this.cleanupBubbles();
                this.scene.restart();
            })
            .setDepth(10)
            .on('pointerover', () => playAgain.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => playAgain.setStyle({ fill: '#FFF' }))
        //TODO show an in-game button or something
    }

    private addProgressCounter() {
        // Use the same scaling system as other buttons
        const scaleFactor = this.getUIScaleFactor();
        const fontSize = Math.round(32 * scaleFactor);
        const padding = Math.round(20 * scaleFactor);
        const paddingV = Math.round(10 * scaleFactor);

        const displayText = this.TOTAL_BUBBLES === -1 ? 'Bubbles: ∞' : `Bubbles: ${this.TOTAL_BUBBLES}`;
        this.progressText = this.add.text(this.scale.gameSize.width - 10, 10, displayText, {
            fontSize: `${fontSize}px`,
            color: 'white'
        })
            .setOrigin(1, 0)
            .setPadding(padding, paddingV, padding, paddingV)
            .setStyle({ backgroundColor: '#333' })
            .setDepth(10);
    }

    private setBubbleCount(newCount: number) {
        // Set the bubble count to the specified value
        this.TOTAL_BUBBLES = newCount;

        // Save the new setting
        this.saveSettings();

        // Update the display text immediately
        const displayText = this.TOTAL_BUBBLES === -1 ? 'Bubbles: ∞' : `Bubbles: ${this.TOTAL_BUBBLES}`;
        this.progressText.setText(displayText);

        // Reset the game with new bubble count
        this.resetGame(true); // Preserve settings panel when changing bubble count
    }

    private resetGame(preserveSettingsPanel = false) {
        // Set reset flag to prevent phantom bubble creation
        this.isResetting = true;

        // Clear all existing bubbles and completely reset state
        this.cleanupBubbles(preserveSettingsPanel);

        // Reset game state
        this.bubblesPopped = 0;
        this.bubbleBucket = [];

        // Small delay to ensure cleanup is complete before recreating
        this.time.delayedCall(50, () => {
            // Recreate the bubble bucket and grid
            this.createBubbleBucket();
            this.fillBubbleGrid();

            // Update the progress counter
            this.updateProgressCounter();

            // Clear reset flag
            this.isResetting = false;
        });
    }

    private updateProgressCounter() {
        if (this.TOTAL_BUBBLES === -1) {
            // Infinite mode - just show bubbles popped
            this.progressText.setText(`Bubbles: ${this.bubblesPopped} popped`);
        } else {
            const bubblesLeft = this.TOTAL_BUBBLES - this.bubblesPopped;
            this.progressText.setText(`Bubbles: ${bubblesLeft}`);
        }
    }

    private resetBubbleInteractivity(bubble: Sprite) {
        const currentX = bubble.x;
        const currentY = bubble.y;

        // Stop any existing tweens on this bubble
        this.tweens.killTweensOf(bubble);
        if ((bubble as any).floatTween) {
            (bubble as any).floatTween.destroy();
            (bubble as any).floatTween = null;
        }

        // Make sure the bubble is still in the right position
        bubble.x = currentX;
        bubble.y = currentY;

        // Reset interactive state - remove all existing listeners and add new one
        bubble.removeAllListeners();
        bubble.setInteractive({
            cursor: 'pointer'
        });

        // Add click handler based on current mode
        if (!this.dragToKillEnabled) {
            // Use on() instead of once() to handle multiple potential clicks
            bubble.on('pointerdown', () => {
                // Don't pop bubbles if settings panel is open
                if (this.settingsPanelVisible) return;

                // Double-check bubble is still in active set before popping
                if (this.bubbles.has(bubble)) {
                    this.popBubble(bubble);
                }
            });
        }
        // For drag mode, the drag handler will take care of popping

        // Create new floating animation
        const floatTween = this.tweens.add({
            targets: bubble,
            props: {
                x: { value: `+=${randomInt(1, 10)}`, duration: randomInt(1000, 1500), delay: randomInt(1, 1000), ease: 'Sine.easeInOut' },
                y: { value: `+=${randomInt(1, 10)}`, duration: randomInt(2000, 2500), delay: randomInt(1, 1000), ease: 'Sine.easeInOut' },
                scaleX: { value: `+=.0${randomInt(1, 3)}`, duration: randomInt(2000, 3000), delay: randomInt(1, 1000), ease: 'Sine.easeInOut' },
                scaleY: { value: `+=.0${randomInt(1, 3)}`, duration: randomInt(1000, 2000), delay: randomInt(1, 1000), ease: 'Sine.easeInOut' }
            },
            repeat: -1,
            yoyo: true
        });

        // Store the new tween reference
        (bubble as any).floatTween = floatTween;
    }

    private repositionProgressCounter() {
        if (this.progressText) {
            this.progressText.setPosition(this.scale.gameSize.width - 10, 10);
        }
        if (this.progressHint) {
            this.progressHint.setPosition(this.scale.gameSize.width - 10, 60);
        }
    }

    private setupDragToKill() {
        let isDragging = false;
        let lastDraggedBubble: Sprite | null = null;

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.dragToKillEnabled && !this.settingsPanelVisible) {
                isDragging = true;
                lastDraggedBubble = null;

                // Check if the initial touch/click is over a bubble and pop it immediately
                const bubbleAtPointer = this.getBubbleAtPosition(pointer.x, pointer.y);
                if (bubbleAtPointer) {
                    this.popBubble(bubbleAtPointer);
                    lastDraggedBubble = bubbleAtPointer;
                }
            }
        });

        this.input.on('pointerup', () => {
            isDragging = false;
            lastDraggedBubble = null;
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.dragToKillEnabled && isDragging && !this.settingsPanelVisible) {
                // Check if pointer is over any bubble
                const bubbleAtPointer = this.getBubbleAtPosition(pointer.x, pointer.y);
                if (bubbleAtPointer && bubbleAtPointer !== lastDraggedBubble) {
                    this.popBubble(bubbleAtPointer);
                    lastDraggedBubble = bubbleAtPointer;
                }
            }
        });
    }

    private getBubbleAtPosition(x: number, y: number): Sprite | null {
        for (const bubble of this.bubbles) {
            const bounds = bubble.getBounds();
            if (bounds.contains(x, y)) {
                return bubble;
            }
        }
        return null;
    }

    private toggleSettingsPanel() {
        if (this.settingsPanelVisible) {
            this.hideSettingsPanel();
        } else {
            this.showSettingsPanel();
        }
    }

    private showSettingsPanel() {
        if (this.settingsPanelVisible) return;

        // Get scaling factor for responsive design
        const scaleFactor = this.getUIScaleFactor();

        // Create semi-transparent background overlay
        this.settingsBackground = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.gameWidth,
            this.gameHeight,
            0x000000,
            0.7
        ).setDepth(20).setInteractive();

        // Create main container for the settings panel
        this.settingsPanel = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY);
        this.settingsPanel.setDepth(21);

        // Panel background - scale with screen size - make it bigger
        const panelWidth = Math.round(600 * scaleFactor); // Increased from 450
        const panelHeight = Math.round(600 * scaleFactor); // Increased from 450
        const panelBg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x333333);
        panelBg.setStrokeStyle(Math.round(3 * scaleFactor), 0x555555); // Increased stroke width

        // Panel title - scale font size larger
        const titleFontSize = Math.round(48 * scaleFactor); // Increased from 32
        const titleY = Math.round(-260 * scaleFactor); // Adjusted position for larger panel
        const title = this.add.text(0, titleY, 'Settings', {
            fontSize: `${titleFontSize}px`,
            color: 'white',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Close button (X) - scale position, size and padding larger
        const closeButtonFontSize = Math.round(56 * scaleFactor); // Increased from 36
        const closeButtonX = Math.round(260 * scaleFactor); // Adjusted for larger panel
        const closeButtonPaddingH = Math.round(16 * scaleFactor); // Increased from 10
        const closeButtonPaddingV = Math.round(12 * scaleFactor); // Increased from 5
        const closeButton = this.add.text(closeButtonX, titleY, '×', {
            fontSize: `${closeButtonFontSize}px`,
            color: 'white'
        })
        .setOrigin(0.5)
        .setPadding(closeButtonPaddingH, closeButtonPaddingV, closeButtonPaddingH, closeButtonPaddingV)
        .setStyle({ backgroundColor: '#666' })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.hideSettingsPanel())
        .on('pointerover', () => closeButton.setStyle({ fill: '#f39c12', backgroundColor: '#888' }))
        .on('pointerout', () => closeButton.setStyle({ fill: '#FFF', backgroundColor: '#666' }));

        // Bubble Count Selection - scale font and position larger
        const labelFontSize = Math.round(32 * scaleFactor); // Increased from 20
        const labelY = Math.round(-180 * scaleFactor); // Adjusted for larger panel
        const bubbleCountLabel = this.add.text(0, labelY, 'Bubble Count:', {
            fontSize: `${labelFontSize}px`,
            color: 'white',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Create bubble count control with textbox and +/-5 buttons
        const controlY = Math.round(-120 * scaleFactor);
        const buttonFontSize = Math.round(32 * scaleFactor);
        const textboxFontSize = Math.round(28 * scaleFactor);
        const buttonPadding = Math.round(16 * scaleFactor);
        const buttonPaddingV = Math.round(12 * scaleFactor);

        // -5 button
        const minusButton = this.add.text(Math.round(-120 * scaleFactor), controlY, '-5', {
            fontSize: `${buttonFontSize}px`,
            color: 'white'
        })
        .setOrigin(0.5)
        .setPadding(buttonPadding, buttonPaddingV, buttonPadding, buttonPaddingV)
        .setStyle({ backgroundColor: '#555' })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            if (this.TOTAL_BUBBLES === -1) {
                // Exit infinite mode and set to 45 (50 - 5)
                const newCount = 45;
                this.setBubbleCount(newCount);
                this.updateInfiniteButtonAndCountText(infiniteButton, bubbleCountText);
            } else {
                const newCount = Math.max(5, this.TOTAL_BUBBLES - 5);
                this.setBubbleCount(newCount);
                bubbleCountText.setText(newCount.toString());
            }
        })
        .on('pointerover', () => minusButton.setStyle({ fill: '#f39c12', backgroundColor: '#777' }))
        .on('pointerout', () => minusButton.setStyle({ fill: '#FFF', backgroundColor: '#555' }));

        // Current count textbox
        const currentCountText = this.TOTAL_BUBBLES === -1 ? '∞' : this.TOTAL_BUBBLES.toString();
        const bubbleCountText = this.add.text(0, controlY, currentCountText, {
            fontSize: `${textboxFontSize}px`,
            color: 'white'
        })
        .setOrigin(0.5)
        .setPadding(Math.round(20 * scaleFactor), Math.round(10 * scaleFactor), Math.round(20 * scaleFactor), Math.round(10 * scaleFactor))
        .setStyle({ backgroundColor: '#222', borderColor: '#666', borderWidth: 2 });

        // +5 button
        const plusButton = this.add.text(Math.round(120 * scaleFactor), controlY, '+5', {
            fontSize: `${buttonFontSize}px`,
            color: 'white'
        })
        .setOrigin(0.5)
        .setPadding(buttonPadding, buttonPaddingV, buttonPadding, buttonPaddingV)
        .setStyle({ backgroundColor: '#555' })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            if (this.TOTAL_BUBBLES === -1) {
                // Exit infinite mode and set to 55 (50 + 5)
                const newCount = 55;
                this.setBubbleCount(newCount);
                this.updateInfiniteButtonAndCountText(infiniteButton, bubbleCountText);
            } else {
                const newCount = this.TOTAL_BUBBLES + 5;
                this.setBubbleCount(newCount);
                bubbleCountText.setText(newCount.toString());
            }
        })
        .on('pointerover', () => plusButton.setStyle({ fill: '#f39c12', backgroundColor: '#777' }))
        .on('pointerout', () => plusButton.setStyle({ fill: '#FFF', backgroundColor: '#555' }));

        // Infinite mode button
        const infiniteY = Math.round(-60 * scaleFactor);
        const infiniteButton = this.add.text(0, infiniteY, this.TOTAL_BUBBLES === -1 ? 'Exit Infinite' : 'Infinite Mode', {
            fontSize: `${buttonFontSize}px`,
            color: 'white'
        })
        .setOrigin(0.5)
        .setPadding(Math.round(24 * scaleFactor), buttonPaddingV, Math.round(24 * scaleFactor), buttonPaddingV)
        .setStyle({ backgroundColor: this.TOTAL_BUBBLES === -1 ? '#cc6600' : '#006600' })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            if (this.TOTAL_BUBBLES === -1) {
                // Exit infinite mode - set to 50
                this.setBubbleCount(50);
            } else {
                // Enter infinite mode
                this.setBubbleCount(-1);
            }
            this.updateInfiniteButtonAndCountText(infiniteButton, bubbleCountText);
        })
        .on('pointerover', () => infiniteButton.setStyle({ fill: '#f39c12' }))
        .on('pointerout', () => infiniteButton.setStyle({ fill: '#FFF' }));

        // Drag Mode Toggle - scale positions, fonts, and padding larger
        const dragModeY = Math.round(100 * scaleFactor); // Moved down for larger spacing
        const dragLabel = this.add.text(Math.round(-200 * scaleFactor), dragModeY, 'Drag Mode:', { // Moved further left
            fontSize: `${labelFontSize}px`,
            color: 'white'
        }).setOrigin(0, 0.5);

        const toggleButtonFontSize = Math.round(32 * scaleFactor); // Increased from 20
        const toggleButtonPadding = Math.round(32 * scaleFactor); // Increased from 20
        const toggleButtonPaddingV = Math.round(16 * scaleFactor); // Increased from 8
        const dragToggleButton = this.add.text(Math.round(80 * scaleFactor), dragModeY, this.dragToKillEnabled ? 'ON' : 'OFF', { // Moved right
            fontSize: `${toggleButtonFontSize}px`,
            color: 'white'
        })
        .setOrigin(0.5)
        .setPadding(toggleButtonPadding, toggleButtonPaddingV, toggleButtonPadding, toggleButtonPaddingV)
        .setStyle({ backgroundColor: this.dragToKillEnabled ? '#006600' : '#666' })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.dragToKillEnabled = !this.dragToKillEnabled;
            dragToggleButton.setText(this.dragToKillEnabled ? 'ON' : 'OFF');
            dragToggleButton.setStyle({ backgroundColor: this.dragToKillEnabled ? '#006600' : '#666' });

            // Save the new setting
            this.saveSettings();

            // Update all existing bubbles to use the new interaction mode
            this.time.delayedCall(10, () => {
                this.bubbles.forEach(bubble => {
                    this.resetBubbleInteractivity(bubble);
                });
            });
        })
        .on('pointerover', () => dragToggleButton.setStyle({ fill: '#f39c12' }))
        .on('pointerout', () => dragToggleButton.setStyle({ fill: '#FFF' }));

        // Description text - scale font and position larger
        const descriptionFontSize = Math.round(22 * scaleFactor); // Increased from 14
        const descriptionY = Math.round(160 * scaleFactor); // Moved down for larger spacing
        const dragDescription = this.add.text(0, descriptionY, 'When enabled, drag to pop bubbles\ninstead of clicking', {
            fontSize: `${descriptionFontSize}px`,
            color: '#ccc',
            align: 'center'
        }).setOrigin(0.5);

        // Add all elements to the container
        this.settingsPanel.add([panelBg, title, closeButton, bubbleCountLabel, minusButton, bubbleCountText, plusButton, infiniteButton, dragLabel, dragToggleButton, dragDescription]);

        // Animate panel in
        this.settingsPanel.setAlpha(0);
        this.settingsPanel.setScale(0.8);

        this.tweens.add({
            targets: this.settingsPanel,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 200,
            ease: 'Back.easeOut'
        });

        this.settingsPanelVisible = true;

        // Close panel when clicking on background
        this.settingsBackground.on('pointerdown', () => this.hideSettingsPanel());
    }

    private hideSettingsPanel() {
        if (!this.settingsPanelVisible) return;

        this.tweens.add({
            targets: this.settingsPanel,
            alpha: 0,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 150,
            ease: 'Back.easeIn',
            onComplete: () => {
                this.settingsPanel?.destroy();
                this.settingsBackground?.destroy();
                this.settingsPanelVisible = false;
            }
        });
    }

    /**
     * Calculate the top margin space needed for buttons and UI elements
     */
    private getTopMargin(): number {
        const scaleFactor = this.getUIScaleFactor();

        // Base margin on button size plus minimal padding
        // The back button is typically the tallest element in the top area
        const buttonHeight = Math.round(60 * scaleFactor) + Math.round(12 * scaleFactor * 2); // font size + vertical padding

        return buttonHeight - 10;
    }

    /**
     * Helper function to update the infinite button text/style and bubble count text
     * based on the current TOTAL_BUBBLES value
     */
    private updateInfiniteButtonAndCountText(infiniteButton: Text, bubbleCountText: Text) {
        if (this.TOTAL_BUBBLES === -1) {
            infiniteButton.setText('Exit Infinite');
            infiniteButton.setStyle({ backgroundColor: '#cc6600' });
            bubbleCountText.setText('∞');
        } else {
            infiniteButton.setText('Infinite Mode');
            infiniteButton.setStyle({ backgroundColor: '#006600' });
            bubbleCountText.setText(this.TOTAL_BUBBLES.toString());
        }
    }

}
