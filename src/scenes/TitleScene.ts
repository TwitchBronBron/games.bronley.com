import Phaser from 'phaser';
import { SceneName } from '../constants';

export default class TitleScene extends Phaser.Scene {
    constructor() {
        super(SceneName.TitleScene);
    }

    preload() {
    }

    create() {
        const startButton = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Start game', { fontSize: '48px', color: 'white' })
            .setOrigin(0.5)
            .setResolution(10)
            .setPadding(40)
            .setStyle({ backgroundColor: '#111' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.switch(SceneName.ShapeRepairScene);
            })
            .on('pointerover', () => startButton.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => startButton.setStyle({ fill: '#FFF' }))
    }

    public update(time: number, delta: number): void {
    }
}

