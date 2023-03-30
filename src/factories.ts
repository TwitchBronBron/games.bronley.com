import { Border, getBorder, getPadding, Padding, PaddingLike } from "./util";


let buttonTextureIndex = 0;
/**
 * Create a button from graphics and text
 */
export function createButton(scene: Phaser.Scene, config: CreateButtonConfig) {
    const text = scene.make.text({
        text: config.text,
        style: {
            color: config.color ?? 'white',
            fontSize: config.fontSize ?? '16px'
        }
    });

    const padding = getPadding(config.padding);
    const border = getBorder(config.border);
    const graphics = scene.make.graphics({ x: 0, y: 0, add: true });
    graphics.lineStyle(border.width, border.color, 1);
    graphics.fillStyle(config.backgroundColor ?? 0, 1);
    const buttonWidth = text.width + padding.left + padding.right
    const buttonHeight = text.height + padding.top + padding.bottom;
    graphics.fillRect(0, 0, buttonWidth, buttonHeight);
    graphics.strokeRect(0, 0, buttonWidth, buttonHeight);
    graphics.fillPath();
    graphics.strokePath();
    const textureKey = 'button' + buttonTextureIndex++;
    graphics.generateTexture(textureKey, buttonWidth, buttonHeight);
    graphics.destroy();

    const button = scene.make.image({
        key: textureKey
    });
    button.setInteractive();
    button.x = 0 + buttonWidth / 2;
    button.y = 0 + buttonHeight / 2;

    if (config.pointerup) {
        button.on('pointerup', config.pointerup);
    }
    if (config.pointerdown) {
        button.on('pointerup', config.pointerdown);
    }
    //center the text in the button
    text.x = padding.left;
    text.y = padding.top;
    text.depth = 1;
    const container = scene.make.container({});
    container.add(button);
    container.add(text);
    return container;
}
export interface CreateButtonConfig {
    /**
     * The button text
     */
    text: string;
    /**
     * The font color
     */
    color?: string;
    /**
     * The size of the font
     */
    fontSize?: string;
    /**
     * The color of the background of the button
     */
    backgroundColor?: number;
    /**
     * The padding of the button
     */
    padding?: PaddingLike;
    /**
     * The border of the button
     */
    border?: Partial<Border>,
    pointerdown?: Function,
    pointerup?: Function
}