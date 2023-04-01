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
     * The percent of the entire window each bubble should be
     */
    private bubbleSize = 200;

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

    }

    create() {
        console.log('create bubble scene');
        this.addBackButton();
        this.computeSizing();

        const bubbles = [];

        const maxBubblesHoriz = Math.round(this.gameWidth / this.bubbleSize) - 1;
        const maxBubblesVert = Math.round(this.gameHeight / this.bubbleSize) - 1;

        for (let i = 0; i < maxBubblesHoriz * maxBubblesVert; i++) {
            const bubble = this.createBubble(0, 0);
            bubbles.push(bubble);
        }

        Phaser.Actions.GridAlign(bubbles, {
            width: maxBubblesHoriz,
            height: maxBubblesVert,
            position: Phaser.Display.Align.CENTER,
            cellWidth: Math.floor(this.gameWidth / maxBubblesHoriz),
            cellHeight: Math.floor(this.gameHeight / maxBubblesVert),
            x: this.bubbleSize / 2,
            y: this.bubbleSize / 2
        });
    }

    finalize() {
        this.victorySound?.play();
        this.addPlayAgainButton();
    }

    private backButton!: Text;

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

    private popBubble(bubble: Sprite) {
        var particle = this.add.particles('spark');
        particle.setDepth(10);
        var emitter = particle.createEmitter({
            quantity: 3,
            speed: 2000,
            accelerationY: 30000,
            scale: { start: 0.15, end: 0.001 },
            blendMode: Phaser.BlendModes.SCREEN
        });
        // emitter.setTint(bubble.tintBottomLeft);
        emitter.setPosition(bubble.x, bubble.y);
        // emitter.setBounds(bubble.x - this.bubbleSize, bubble.y - this.bubbleSize, this.bubbleSize * 2, this.bubbleSize * 2);

        bubble.setOrigin(.5, .5);
        // bubble.destroy();
        this.popSound?.play();
        this.tweens.add({
            targets: bubble,
            scaleX: 0,
            scaleY: 0,
            ease: 'Sine.easeInOut',
            duration: 100,
            onComplete: () => {
                bubble.destroy();
                emitter.stop();
                // particle.destroy();

                this.bubbles.delete(bubble);
                if (this.bubbles.size === 0) {
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
        bubble.once('pointerdown', () => {
            this.popBubble(bubble);
        });
        this.bubbles.add(bubble);
        this.tweens.add({
            targets: bubble,
            props: {
                x: { value: `+=${randomInt(1, 10)}`, duration: randomInt(800, 1150), delay: randomInt(1, 1000), ease: 'Sine.easeInOut' },
                y: { value: `+=${randomInt(1, 10)}`, duration: randomInt(800, 1150), delay: randomInt(1, 1000), ease: 'Sine.easeInOut' },
                scaleX: { value: `+=.0${randomInt(1, 3)}`, duration: randomInt(900, 1500), delay: randomInt(1, 1000), ease: 'Sine.easeInOut' },
                scaleY: { value: `+=.0${randomInt(1, 3)}`, duration: randomInt(900, 1500), delay: randomInt(1, 1000), ease: 'Sine.easeInOut' }
            },
            repeat: -1,
            yoyo: true
        });
        return bubble;
    }

    private computeSizing() {
        const bubble = this.createBubble(0, 0);
        this.bubbleWidth = bubble.displayWidth;
        this.bubbleHeight = bubble.displayHeight;
        bubble.destroy();
        this.bubbles.delete(bubble);
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
                this.scene.restart();
            })
            .setDepth(10)
            .on('pointerover', () => playAgain.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => playAgain.setStyle({ fill: '#FFF' }))
        //TODO show an in-game button or something
    }

}