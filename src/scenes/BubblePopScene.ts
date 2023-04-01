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
    private padding = 8;
    /**
     * The percent of the entire window each bubble should be
     */
    private bubbleScale = .175;


    preload() {
        this.load.audio('pop', ['assets/audio/pop2.mp3']).once('filecomplete-audio-pop', (key: string) => {
            this.pop = this.sound.add(key);
        });
        this.load.image('bubble', 'assets/images/bubble.png');
    }

    create() {
        this.addBackButton();
        this.computeSizing();
        this.createBubbleGrid();
    }

    private backButton!: Text;

    private pop!: Phaser.Sound.BaseSound;
    private colorFactory = createColorFactory();

    private bubbleWidth = 0;
    private bubbleHeight = 0;

    private get gameWidth() {
        return this.scale.gameSize.width;
    }

    private bubbles: Sprite[] = [];

    createBubbleGrid() {
        let y = 0;
        while (true) {
            this.createBubbleRow(y);
            y += this.padding + this.bubbleHeight;
            if (y >= this.scale.gameSize.height) {
                break;
            }
        }
    }

    private createBubbleRow(y: number) {
        let x = 0;
        while (true) {
            this.createBubble(x, y);
            x += this.padding + this.bubbleWidth;
            if (x >= this.scale.gameSize.width) {
                break;
            }
        }
    }

    private createBubble(x: number, y: number) {
        const bubble = this.add.sprite(x, y, 'bubble');
        bubble.displayWidth = this.gameWidth * this.bubbleScale;
        bubble.scaleY = bubble.scaleX;
        bubble.tint = this.colorFactory();
        bubble.setOrigin(0, 0);
        bubble.setPosition(x, y);
        bubble.setInteractive();
        bubble.once('pointerdown', () => {
            bubble.destroy();
            this.pop?.play();
        });
        this.bubbles.push(bubble);
        this.tweens.add({
            targets: bubble,
            props: {
                x: '+=3',
                y: '+=3'
            },
            ease: 'Sine.easeInOut',
            duration: 900,
            delay: getRandomIntInclusive(50, 1000),
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
}