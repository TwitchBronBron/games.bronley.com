import Phaser from 'phaser';
import { SceneName } from '../constants';

export default class TitleScene extends Phaser.Scene {
    private buildTimestamp!: Phaser.GameObjects.Text;

    constructor() {
        super(SceneName.TitleScene);
    }

    preload() {
        this.load.image('bubble-tile', 'assets/images/bubble-tile.png');
        this.load.image('shape-tile', 'assets/images/shape-tile.png');
    }

    create() {
        const gameName = new URLSearchParams(window.location.search).get('game');
        if (gameName) {
            this.scene.switch(gameName);
        }
        this.add.image(this.cameras.main.centerX - 250, this.cameras.main.centerY, 'bubble-tile')
            .setDisplaySize(300, 300)
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.switch(SceneName.BubblePopScene);
            });

        const popperButton = this.add.text(this.cameras.main.centerX - 250, this.cameras.main.centerY, 'Bubble Popper', { fontSize: '35px', color: 'white' })
            .setOrigin(0.5)
            .setResolution(10)
            .setPadding(5)
            .setStyle({ backgroundColor: '#111' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.switch(SceneName.BubblePopScene);
            })
            .on('pointerover', () => popperButton.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => popperButton.setStyle({ fill: '#FFF' }))


        this.add.image(this.cameras.main.centerX + 250, this.cameras.main.centerY, 'shape-tile')
            .setDisplaySize(300, 300)
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.switch(SceneName.ShapeRepairScene);
            });

        const shapesButton = this.add.text(this.cameras.main.centerX + 250, this.cameras.main.centerY, 'Shapes', { fontSize: '35px', color: 'white' })
            .setOrigin(0.5)
            .setResolution(10)
            .setPadding(75, 5, 75, 5)
            .setStyle({ backgroundColor: '#111' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.switch(SceneName.ShapeRepairScene);
            })
            .on('pointerover', () => shapesButton.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => shapesButton.setStyle({ fill: '#FFF' }))

        // Add build timestamp at bottom right
        this.buildTimestamp = this.add.text(this.cameras.main.width - 10, this.cameras.main.height - 10,
            `Build: ${__BUILD_TIMESTAMP__}`, {
            fontSize: '12px',
            color: '#FFFFFF',
            fontFamily: 'monospace'
        })
        .setOrigin(1, 1) // Anchor to bottom right
        .setDepth(100); // Ensure it's on top

        // Listen for resize events to reposition timestamp
        this.scale.on('resize', this.handleResize, this);
    }

    private handleResize() {
        if (this.buildTimestamp) {
            this.buildTimestamp.setPosition(this.cameras.main.width - 10, this.cameras.main.height - 10);
        }
    }

    public update(time: number, delta: number): void {
    }
}
