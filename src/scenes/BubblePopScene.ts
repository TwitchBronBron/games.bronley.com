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
     * The size of each bubble in pixels
     */
    private bubbleSize = 200;

    /**
     * Total number of bubbles in the game - when this bucket is empty, the player wins
     */
    private TOTAL_BUBBLES = 50;

    /**
     * Available bubble count options (infinite is represented as -1)
     */
    private readonly BUBBLE_COUNT_OPTIONS = [20, 50, 200, -1];

    /**
     * Current index in the bubble count options
     */
    private bubbleCountIndex = 1; // Start with 50 bubbles

    /**
     * Delay in milliseconds before a popped bubble spot gets refilled
     */
    private readonly REFILL_DELAY = 1000;

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
        this.cleanupBubbles(); // Clean up any existing bubbles from previous runs
        this.addBackButton();
        this.addDragToggle();
        this.addProgressCounter();
        this.computeSizing();
        this.createBubbleGrid();

        // Listen for resize events
        this.scale.on('resize', this.handleResize, this);

        // Set up drag-to-kill input handling
        this.setupDragToKill();
    }

    private createBubbleGrid() {
        // Create the bucket of bubbles
        this.createBubbleBucket();

        // Fill the initial grid
        this.fillBubbleGrid();
    }

    private createBubbleBucket() {
        // Create all bubbles and store them in the bucket (initially hidden)
        for (let i = 0; i < this.TOTAL_BUBBLES; i++) {
            const bubble = this.createBubble(0, 0);
            bubble.setVisible(false);
            bubble.setAlpha(1); // Ensure alpha is set to 1 for reuse
            bubble.x = -1000; // Move offscreen
            bubble.y = -1000;
            this.bubbleBucket.push(bubble);
        }
    }

    private fillBubbleGrid() {
        const maxBubblesHoriz = Math.round(this.gameWidth / this.bubbleSize);
        const maxBubblesVert = Math.round(this.gameHeight / this.bubbleSize);
        const maxVisibleBubbles = maxBubblesHoriz * maxBubblesVert;

        // Check which bubbles are still within the visible area
        const bubblesStillVisible: Sprite[] = [];
        const bubblesToHide: Sprite[] = [];

        this.bubbles.forEach(bubble => {
            const col = Math.round((bubble.x - this.bubbleSize / 2) / this.bubbleSize);
            const row = Math.round((bubble.y - this.bubbleSize / 2) / this.bubbleSize);

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
            const row = Math.round((bubble.y - this.bubbleSize / 2) / this.bubbleSize);
            occupiedPositions.add(`${row},${col}`);
        });

        // Fill empty spots with bubbles from the bucket
        const spotsToFill = maxVisibleBubbles - bubblesStillVisible.length;
        const bubblesWeCanAdd = Math.min(spotsToFill, this.bubbleBucket.length);

        let bubblesAdded = 0;
        for (let row = 0; row < maxBubblesVert && bubblesAdded < bubblesWeCanAdd; row++) {
            for (let col = 0; col < maxBubblesHoriz && bubblesAdded < bubblesWeCanAdd; col++) {
                const positionKey = `${row},${col}`;

                // If this position is empty, fill it
                if (!occupiedPositions.has(positionKey)) {
                    const bubble = this.bubbleBucket.shift()!; // Take from bucket

                    bubble.x = col * this.bubbleSize + this.bubbleSize / 2;
                    bubble.y = row * this.bubbleSize + this.bubbleSize / 2;
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

        // Refill the grid using the bucket system
        this.fillBubbleGrid();
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
                } else if (this.TOTAL_BUBBLES === -1 && this.isPositionEmpty(x, y)) {
                    // Create a new bubble for infinite mode
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

                    // Start with alpha 0 for fade-in animation
                    bubble.setAlpha(0);

                    // Animate the bubble fading in
                    this.tweens.add({
                        targets: bubble,
                        alpha: 1,
                        ease: 'Cubic.easeInOut',
                        duration: 1500,
                        onComplete: () => {
                            // Reset interactive state and animations after fade-in completes
                            this.resetBubbleInteractivity(bubble);
                        }
                    });

                    // Add to active bubbles set
                    this.bubbles.add(bubble);
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

    private cleanupBubbles() {
        // Clear all pending refill timers first
        this.pendingRefills.clear();

        // Remove all pending time events to prevent phantom bubbles
        this.time.removeAllEvents();

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
    private dragToggle!: Text;
    private progressText!: Text;
    private progressHint!: Text;

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
        this.backButton = this.add.text(10, 10, '←', { fontSize: '48px', color: 'white' })
            .setOrigin(0)
            .setPadding(20, 0, 20, 10)
            .setStyle({ backgroundColor: '#111' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.restart();
                this.scene.switch(SceneName.TitleScene);
            })
            .setDepth(10)
            .on('pointerover', () => this.backButton.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => this.backButton.setStyle({ fill: '#FFF' }))
    }

    private addPlayAgainButton() {
        var playAgain = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Play Again', { fontSize: '48px', color: 'white' })
            .setOrigin(.5)
            .setPadding(50)
            .setResolution(10)
            .setStyle({ backgroundColor: 'green' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.cleanupBubbles();
                this.scene.restart();
            })
            .setDepth(10)
            .on('pointerover', () => playAgain.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => playAgain.setStyle({ fill: '#FFF' }))
        //TODO show an in-game button or something
    }

    private addProgressCounter() {
        const displayText = this.TOTAL_BUBBLES === -1 ? 'Bubbles: ∞' : `Bubbles: ${this.TOTAL_BUBBLES}`;
        this.progressText = this.add.text(this.scale.gameSize.width - 10, 10, displayText, {
            fontSize: '32px',
            color: 'white'
        })
            .setOrigin(1, 0)
            .setPadding(20, 10, 20, 10)
            .setStyle({ backgroundColor: '#333' })
            .setDepth(10)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.cycleBubbleCount())
            .on('pointerover', () => this.progressText.setStyle({ fill: '#f39c12', backgroundColor: '#555' }))
            .on('pointerout', () => this.progressText.setStyle({ fill: '#FFF', backgroundColor: '#333' }));
    }

    private cycleBubbleCount() {
        // Cycle to the next bubble count option
        this.bubbleCountIndex = (this.bubbleCountIndex + 1) % this.BUBBLE_COUNT_OPTIONS.length;
        this.TOTAL_BUBBLES = this.BUBBLE_COUNT_OPTIONS[this.bubbleCountIndex];

        // Update the display text immediately
        const displayText = this.TOTAL_BUBBLES === -1 ? 'Bubbles: ∞' : `Bubbles: ${this.TOTAL_BUBBLES}`;
        this.progressText.setText(displayText);

        // Reset the game with new bubble count
        this.resetGame();
    }    private resetGame() {
        // Set reset flag to prevent phantom bubble creation
        this.isResetting = true;

        // Clear all existing bubbles and completely reset state
        this.cleanupBubbles();

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

    private addDragToggle() {
        this.dragToggle = this.add.text(10, 70, 'Drag: OFF', { fontSize: '24px', color: 'white' })
            .setOrigin(0)
            .setPadding(15, 5, 15, 5)
            .setStyle({ backgroundColor: '#444' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.dragToKillEnabled = !this.dragToKillEnabled;
                this.dragToggle.setText(`Drag: ${this.dragToKillEnabled ? 'ON' : 'OFF'}`);
                this.dragToggle.setStyle({ backgroundColor: this.dragToKillEnabled ? '#006600' : '#444' });

                // Update all existing bubbles to use the new interaction mode
                // Use a small delay to ensure the mode change is complete
                this.time.delayedCall(10, () => {
                    this.bubbles.forEach(bubble => {
                        this.resetBubbleInteractivity(bubble);
                    });
                });
            })
            .setDepth(10)
            .on('pointerover', () => this.dragToggle.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => this.dragToggle.setStyle({ fill: '#FFF' }));
    }

    private setupDragToKill() {
        let isDragging = false;
        let lastDraggedBubble: Sprite | null = null;

        this.input.on('pointerdown', () => {
            if (this.dragToKillEnabled) {
                isDragging = true;
                lastDraggedBubble = null;
            }
        });

        this.input.on('pointerup', () => {
            isDragging = false;
            lastDraggedBubble = null;
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.dragToKillEnabled && isDragging) {
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

}
