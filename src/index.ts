import Phaser from 'phaser';
import { SceneName } from './constants';
import BubblePopScene from './scenes/BubblePopScene';
import ShapeRepairScene from './scenes/ShapeRepairScene';
import TitleScene from './scenes/TitleScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#33A5E7',
  scale: {
    width: 800,
    height: 600,
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade'
  }
});
game.scene.add(SceneName.TitleScene, TitleScene);
game.scene.add(SceneName.ShapeRepairScene, ShapeRepairScene);
game.scene.add(SceneName.BubblePopScene, BubblePopScene);
game.scene.start(SceneName.TitleScene);