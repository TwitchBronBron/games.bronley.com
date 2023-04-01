import Phaser from 'phaser';
import { SceneName } from '../constants';

export default class TitleScene extends Phaser.Scene {
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
    }

    public update(time: number, delta: number): void {
    }
}

