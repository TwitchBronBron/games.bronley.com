import Phaser from 'phaser';
import { SceneName } from '../constants';
import { createColorFactory, getRandomIntInclusive, spliceRandom } from '../util';
type GameObject = Phaser.GameObjects.GameObject;
type Sprite = Phaser.GameObjects.Sprite;
type Pointer = Phaser.Input.Pointer;
type Text = Phaser.GameObjects.Text;

export default class BubblePopScene extends Phaser.Scene {
    constructor() {
        super(SceneName.BubblePopScene);
    }

    /**
     * Pixels of padding between each bubble
     */
    private padding = 10;
    /**
     * The percent of the entire window each bubble should be
     */
    private bubbleScale = .17;


    preload() {
        this.load.image('bubble', 'assets/images/bubble.png');

        this.load.audio('pop', 'assets/audio/pop.mp3').once('filecomplete-audio-pop', (key: string) => {
            this.pop = this.sound.add(key);
        });

        this.load.audio('sparkle', ['assets/audio/sparkle.mp3']).once('filecomplete-audio-sparkle', () => {
            this.victory = this.sound.add('sparkle');
        });

    }

    create() {
        this.addBackButton();
        this.computeSizing();
        this.createBubbleGrid();
    }

    finalize() {
        this.victory?.play();
        this.addPlayAgainButton();
    }

    private backButton!: Text;

    private pop!: Phaser.Sound.BaseSound;
    private victory!: Phaser.Sound.BaseSound;
    private colorFactory = createColorFactory();

    private bubbleWidth = 0;
    private bubbleHeight = 0;

    private get gameWidth() {
        return this.scale.gameSize.width;
    }

    private bubbles = new Set<Sprite>();

    createBubbleGrid() {
        let y = this.padding;
        while (true) {
            this.createBubbleRow(y);
            y += this.padding + this.bubbleHeight;
            if (y >= this.scale.gameSize.height) {
                break;
            }
        }
    }

    private createBubbleRow(y: number) {
        let x = this.padding;
        while (true) {
            this.createBubble(x + this.bubbleWidth / 2, y + this.bubbleHeight / 2);
            x += this.padding + this.bubbleWidth;
            if (x >= this.scale.gameSize.width) {
                break;
            }
        }
    }

    private popBubble(bubble: Sprite) {
        bubble.setOrigin(.5, .5);
        // bubble.destroy();
        this.pop?.play();
        bubble.tint = 0xFFFFFF;
        bubble.tintFill = true;
        this.tweens.add({
            targets: bubble,
            scaleX: 0,
            scaleY: 0,
            ease: 'Sine.easeInOut',
            duration: 100,
            onComplete: () => {
                bubble.destroy();
                this.bubbles.delete(bubble);
                if (this.bubbles.size === 0) {
                    this.finalize();
                }
            }
        })
    }

    private createBubble(x: number, y: number) {
        const bubble = this.add.sprite(x, y, 'bubble');
        bubble.displayWidth = this.gameWidth * this.bubbleScale;
        bubble.scaleY = bubble.scaleX;
        bubble.tint = this.colorFactory();
        bubble.setPosition(x, y);
        bubble.setInteractive();
        bubble.once('pointerdown', () => {
            this.popBubble(bubble);
        });
        this.bubbles.add(bubble);
        this.tweens.add({
            targets: bubble,
            props: {
                x: { value: '+=3', duration: getRandomIntInclusive(800, 1150), delay: getRandomIntInclusive(1, 1000), ease: 'Sine.easeInOut' },
                y: { value: '+=3', duration: getRandomIntInclusive(800, 1150), delay: getRandomIntInclusive(1, 1000), ease: 'Sine.easeInOut' },
                scaleX: { value: '+=.005', duration: 4000, ease: 'Sine.easeInOut' },
                scaleY: { value: '+=.005', duration: 4000, ease: 'Sine.easeInOut' }
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
                this.create();
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
                // this.create();
            })
            .setDepth(10)
            .on('pointerover', () => playAgain.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => playAgain.setStyle({ fill: '#FFF' }))
        //TODO show an in-game button or something
    }

}