import Phaser from 'phaser';
import { SceneName } from '../constants';
import { createButton } from '../factories';
import { computeContainerSize, getRandomIntInclusive, spliceRandom } from '../util';
type Container = Phaser.GameObjects.Container;

export default class TitleScene extends Phaser.Scene {
    constructor() {
        super(SceneName.TitleScene);
    }

    preload() {
    }

    create() {
        const { width, height } = this.scale;
        this.playButton = createButton(this, {
            text: 'Play',
            color: 'white',
            fontSize: '40px',
            padding: [10, 20],
            backgroundColor: 0xFF0000,
            pointerup: () => {
                this.scene.switch(SceneName.ShapeRepairScene);
            }
        });

        computeContainerSize(this.playButton, width, height);

        this.playButton.x = (width / 2) - (this.playButton.width / 2);
        this.playButton.y = (height / 2) - (this.playButton.height / 2);
        this.add.existing(this.playButton);
    }

    private playButton!: Container;

    public update(time: number, delta: number): void {
    }
}

