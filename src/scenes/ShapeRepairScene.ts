import Phaser from 'phaser';
import { SceneName } from '../constants';
import { playSound, preloadSound, randomInt, spliceRandom } from '../util';
type GameObject = Phaser.GameObjects.GameObject;
type Sprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
type Pointer = Phaser.Input.Pointer;
type Text = Phaser.GameObjects.Text;
type BaseSound = Phaser.Sound.BaseSound;

export default class ShapeRepairScene extends Phaser.Scene {
    constructor() {
        super(SceneName.ShapeRepairScene);
    }

    private quadrantColumnCount = 3;
    private quadrantRowCount = 3;
    private resetPositionSpeed = 4500;

    preload() {
        preloadSound(this, 'whoosh');
        preloadSound(this, 'victory');
    }

    create() {
        console.log('create shape scene');
        this.reset();

        this.addBackButton();

        //break the window into quadrants. We always need an even number of quadrants
        this.calculateQuadrants(this.quadrantColumnCount, this.quadrantRowCount)

        //draw the grid for debugging purposes
        this.drawQuadrants();

        //generate shape pairs to fill up quadrants
        const quadrants = [...this.quadrants];
        const colors = [...this.distinctColors];
        while (quadrants.length > 0) {
            const q1 = spliceRandom(quadrants);
            const q2 = spliceRandom(quadrants);
            if (q1 && q2) {
                this.createShapePair(colors.shift()!, q1, q2);
                this.pairsRemaining++;
            }
        }
        console.log('Total pairs created:', this.pairsRemaining);

        this.input.on('drag', function (pointer: Pointer, gameObject: Sprite, dragX: number, dragY: number) {
            gameObject.x = dragX;
            gameObject.y = dragY;
        });

        const dragstartPositions = new Map<GameObject, { x: number; y: number; }>();
        this.input.on('dragstart', (pointer: Pointer, sprite: Sprite, dragX: number, dragY: number) => {
            //draw this sprite on top of everything
            sprite.depth = 1;
            dragstartPositions.set(sprite, { x: sprite.x, y: sprite.y });
        });

        this.input.on('dragend', (pointer: Pointer, sprite: Sprite, dragX: number, dragY: number) => {
            //reset zindex of the sprite now that it's not being dragged
            sprite.depth = 0;

            const spriteBounds = sprite.getBounds();

            const partner = this.shapePairMap.get(sprite);
            const partnerBounds = partner?.getBounds();

            console.log('Drag ended. Checking collision between sprite and partner');
            console.log('Sprite bounds:', spriteBounds);
            console.log('Partner bounds:', partnerBounds);

            //is this shape above its corresponding pair?
            if (Phaser.Geom.Intersects.RectangleToRectangle(spriteBounds, partnerBounds!)) {
                console.log('Collision detected! Finalizing pair');
                this.finalizePair(sprite);

                //the shape is NOT above its corresponding pair. reset its position
            } else {
                console.log('No collision detected. Resetting position');
                const initialPosition = dragstartPositions.get(sprite);
                if (initialPosition) {
                    this.movements.push({
                        sprite: sprite,
                        destination: initialPosition
                    });
                    this.physics.moveTo(sprite, initialPosition.x, initialPosition.y, this.resetPositionSpeed);
                }
            }
            dragstartPositions.delete(sprite);
        });
    }

    private distinctColors = [0xe6194B, 0x3cb44b, 0xffe119, 0x4363d8, 0xf58231, 0x911eb4, 0x42d4f4, 0xf032e6, 0xbfef45, 0xfabed4, 0x469990, 0xdcbeff, 0x9A6324, 0xfffac8, 0x800000, 0xaaffc3, 0x808000, 0xffd8b1, 0x000075, 0xa9a9a9, 0xffffff, 0x000000];

    private quadrants: Quadrant[] = [];

    /**
     * The number of pairs remaining. When this hits 0, this round is over!
     */
    private pairsRemaining = 0;

    /**
     * Links one sprite to its pair. Use for detecting if the sprites are touching when dragend occurs
     */
    private shapePairMap = new Map<Sprite, Sprite>();

    private backButton!: Text;


    private addBackButton() {
        this.backButton = this.add.text(10, 10, '←', { fontSize: '48px', color: 'white' })
            .setOrigin(0)
            .setPadding(20, 0, 20, 10)
            .setStyle({ backgroundColor: '#111' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
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
            .on('pointerover', () => this.backButton.setStyle({ fill: '#f39c12' }))
            .on('pointerout', () => this.backButton.setStyle({ fill: '#FFF' }))
        //TODO show an in-game button or something
    }

    private finishRound() {
        playSound(this, 'victory');
        this.addPlayAgainButton();
    }


    public reset() {
        console.log('Resetting game state');
        this.quadrants = [];
        this.pairsRemaining = 0;

        // Clear shape pairs
        for (const [obj] of this.shapePairMap) {
            if (obj && obj.active) {
                obj.destroy();
            }
        }
        this.shapePairMap.clear();

        // Clear input listeners
        this.input.removeAllListeners();

        // Clear movements array
        this.movements = [];

        // Destroy all children except physics world, but preserve sounds
        const children = [...this.children.list];
        for (const child of children) {
            if (child && (child as any).destroy) {
                (child as any).destroy();
            }
        }

        this.backButton?.destroy();
    }

    private finalizePair(sprite: Sprite) {
        const partner = this.shapePairMap.get(sprite)!;
        sprite.disableInteractive();
        partner?.disableInteractive();
        sprite.x = partner.x;
        sprite.y = partner.y;

        //grey out the finished shapes
        // sprite.alpha = .1;
        // partner.alpha = .1;
        this.pairsRemaining--;
        console.log('Pair completed! Remaining pairs:', this.pairsRemaining);

        playSound(this, 'whoosh');

        // Create scale up tween
        this.tweens.add({
            targets: [sprite, partner],
            duration: 50,
            scaleX: 1.2,
            scaleY: 1.2,
            yoyo: true,
            onComplete: () => {
                // Create scale down tween
                this.tweens.add({
                    targets: [sprite, partner],
                    duration: 50,
                    scaleX: 0.001,
                    scaleY: 0.001,
                    onComplete: () => {
                        sprite.destroy();
                        partner.destroy();
                        console.log('Tween completed. Checking if game is finished. Pairs remaining:', this.pairsRemaining);
                        if (this.pairsRemaining <= 0) {
                            console.log('Game finished! Calling finishRound()');
                            this.finishRound();
                        }
                    }
                });
            }
        });
    }

    private movements: Array<{ sprite: Sprite; destination: Point; }> = [];

    public update(time: number, delta: number): void {
        this.processMovements();
    }

    private processMovements() {
        for (let i = this.movements.length - 1; i >= 0; i--) {
            const movement = this.movements[i];
            //  4 is our distance tolerance, i.e. how close the source can get to the target
            //  before it is considered as being there. The faster it moves, the more tolerance is required.
            // const tolerance = 4;

            const tolerance = this.resetPositionSpeed * 1.5 / this.game.loop.targetFps;

            const distance = Phaser.Math.Distance.BetweenPoints(movement.sprite, movement.destination);

            if (movement.sprite.body.speed > 0) {
                if (distance < tolerance) {
                    movement.sprite.body.reset(movement.destination.x, movement.destination.y);
                    this.movements.splice(i, 1);
                }
            }
        }
    }

    /**
     * Calculate the quadrants avaiable for this game
     */
    private calculateQuadrants(columnCount: number, rowCount: number) {
        let gameWidth = this.scale.gameSize.width;
        const quadrantWidth = gameWidth / columnCount;
        const gameHeight = this.scale.gameSize.height;
        const quadrantHeight = gameHeight / rowCount;

        for (let y = 0; y < gameHeight; y += quadrantHeight) {
            for (let x = 0; x < gameWidth; x += quadrantWidth) {
                const quadrant = {
                    x: x,
                    y: y,
                    centerX: x + quadrantWidth / 2,
                    centerY: y + quadrantHeight / 2,
                    width: quadrantWidth,
                    height: quadrantHeight
                };
                this.quadrants.push(quadrant);
            }
        }
    }

    /**
     * Draw the quadrants on the screen
     */
    private drawQuadrants() {
        for (const quadrant of this.quadrants) {
            const graphics = this.add.graphics();
            graphics.strokeRect(quadrant.x, quadrant.y, quadrant.width, quadrant.height);
            graphics.stroke();
        }
    }

    private makeDraggable(sprite: Phaser.GameObjects.Sprite) {
        sprite.setInteractive(this.input.makePixelPerfect());
        this.input.setDraggable(sprite);
    }

    /**
     * Create a shape split into two chunks, place the first chunk in quadrant1, and the second chunk in quadrant2
     */
    private createShapePair(color: number, quadrant1: Quadrant, quadrant2: Quadrant) {
        //get a random degree that's within a range
        const cutDegree = randomInt(30, 120);
        const radius = Math.min(quadrant1.width, quadrant1.height) / 2.1;

        const bigger = this.createCirclePart(color, radius, 0, cutDegree);
        this.makeDraggable(bigger);
        bigger.x = quadrant1.centerX;
        bigger.y = quadrant1.centerY;

        const smaller = this.createCirclePart(color, radius, cutDegree, 360);
        this.makeDraggable(smaller);
        smaller.x = quadrant2.centerX;
        smaller.y = quadrant2.centerY;

        //link the objects to each other for user in collision detection later
        this.shapePairMap.set(bigger, smaller);
        this.shapePairMap.set(smaller, bigger);

        console.log('Created shape pair. Total shape pairs in map:', this.shapePairMap.size / 2);
    }


    /**
     * Create a partial circle sprite
     */
    private createCirclePart(color: number, radius: number, startDegree: number, endDegree: number) {
        var graphics = this.add.graphics();
        graphics.fillStyle(color, 1);
        //draw the circle
        graphics.lineStyle(3, 0x000000, 1);
        graphics.beginPath();
        graphics.arc(radius, radius, radius, Phaser.Math.DegToRad(endDegree), Phaser.Math.DegToRad(startDegree), true);
        graphics.lineTo(radius, radius);
        graphics.fillPath();
        graphics.strokePath();

        //draw the border
        graphics.arc(radius, radius, radius, Phaser.Math.DegToRad(endDegree), Phaser.Math.DegToRad(startDegree), true);
        graphics.strokePath();

        const textureName = 'texture' + this.textureIndex++;
        //turn the circle into a texture
        graphics.generateTexture(textureName, radius * 2, radius * 2);
        //destroy the graphic now that we have a texture
        graphics.destroy();

        const sprite = this.physics.add.sprite(radius, radius, textureName);
        return sprite;
    }
    private textureIndex = 0;
}

interface Quadrant {
    x: number;
    y: number;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
}

interface Point {
    x: number;
    y: number;
}
