type Container = Phaser.GameObjects.Container;

/**
 * Get a random color between a given min and max, inclusive
 */
export function randomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
}


/**
 * Splice a random item from an array
 */
export function spliceRandom<T>(array: Array<T>) {
    return array.splice(Math.floor(Math.random() * array.length), 1)[0];
}

/**
 * A representation of padding like found in browsers.
 */
export type PaddingLike = number | [number] | [number, number] | [number, number, number] | [number, number, number, number] | Padding;
export type Padding = {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export function getPadding(padding?: PaddingLike): Padding {
    const result = [0, 0, 0, 0];
    //1 value for all for sides
    if (typeof padding === 'number') {
        return { top: padding, right: padding, bottom: padding, left: padding };
    }
    if (Array.isArray(padding)) {
        if (padding.length === 1) {
            return { top: padding[0], right: padding[0], bottom: padding[0], left: padding[0] };
        }
        if (padding.length === 2) {
            return { top: padding[0], right: padding[1], bottom: padding[0], left: padding[1] };
        }
        if (padding.length === 3) {
            return { top: padding[0], right: padding[1], bottom: padding[2], left: padding[1] };
        }
        if (padding.length === 4) {
            return { top: padding[0], right: padding[1], bottom: padding[2], left: padding[3] };
        }
    }
    return {
        top: padding?.top ?? 0,
        right: padding?.right ?? 0,
        bottom: padding?.bottom ?? 0,
        left: padding?.left ?? 0
    };
}

export interface Border {
    width: number;
    color: number;
    alpha: number;
}
export function getBorder(border?: Partial<Border>) {
    return {
        color: border?.color ?? 0x000000,
        width: border?.width ?? 0,
        alpha: border?.alpha ?? 1
    } as Border;
}

export function computeContainerSize(con: Container, width: number, height: number) {
    //set the top position to the bottom of the game
    var top = height;
    var bottom = 0;
    //set the left to the right of the game
    var left = width;
    var right = 0;

    con.iterate((child: any) => {
        //get the positions of the child
        var childX = child.x;
        var childY = child.y;

        var childW = child.displayWidth;
        var childH = child.displayHeight;
        //calcuate the child position based on the origin
        var childTop = childY - (childH * child.originY);
        var childBottom = childY + (childH * (1 - child.originY));
        var childLeft = childX - (childW * child.originX);
        var childRight = childX + (childW * (1 - child.originY));
        //test the positions against
        //top, bottom, left and right
        if (childBottom > bottom) {
            bottom = childBottom;
        }
        if (childTop < top) {
            top = childTop;
        }
        if (childLeft < left) {
            left = childLeft;
        }
        if (childRight > right) {
            right = childRight;
        }
    });
    //calculate the square
    var h = Math.abs(top - bottom);
    var w = Math.abs(right - left);
    //set the container size
    con.setSize(w, h);
}

const distinctColors = [0xe6194B, 0x3cb44b, 0xffe119, 0x4363d8, 0xf58231, 0x911eb4, 0x42d4f4, 0xf032e6, 0xbfef45, 0xfabed4, 0x469990, 0xdcbeff, 0x9A6324, 0xfffac8, 0x800000, 0xaaffc3, 0x808000, 0xffd8b1, 0x000075, 0xa9a9a9, 0xffffff, 0x000000];

/**
 * Get a factory that generates random colors (from the set of predefined allowed colors)
 */
export function createColorFactory() {
    let colors: number[] = [];
    return () => {
        if (colors.length === 0) {
            colors = [...distinctColors];
        }
        return spliceRandom(colors);
    };
}

const sounds = {
    'victory': 'assets/audio/sparkle.mp3',
    'whoosh': 'assets/audio/whoosh.mp3',
    'pop': 'assets/audio/pop.mp3'
};
export type SoundName = keyof typeof sounds;

// Global sound cache to persist across scene switches
const globalSoundCache = new Map<string, Phaser.Sound.BaseSound>();

export function preloadSound(scene: Phaser.Scene & Record<string, any>, soundName: SoundName, callback?: (sound: Phaser.Sound.BaseSound) => void) {
    const key = `${soundName}Sound`;

    // Check if we already have this sound in the global cache
    if (globalSoundCache.has(soundName)) {
        const cachedSound = globalSoundCache.get(soundName)!;
        scene[key] = cachedSound;
        callback?.(cachedSound);
        return;
    }

    if (!scene[key]) {
        scene.load.audio(soundName, [sounds[soundName]]).once(`filecomplete-audio-${soundName}`, () => {
            scene[key] = scene.sound.add(soundName);
            // Store in global cache
            globalSoundCache.set(soundName, scene[key]);
            callback?.(scene[key]);
        });
    } else {
        callback?.(scene[key]);
    }
}

export function playSound(scene: Phaser.Scene & Record<string, any>, soundName: SoundName) {
    console.log(`playSound called for ${soundName} in scene ${scene.scene.key}`);

    if (!scene.sound) {
        console.log('No sound manager available');
        return;
    }

    // Try to get sound from global cache first
    if (globalSoundCache.has(soundName)) {
        const cachedSound = globalSoundCache.get(soundName)!;
        try {
            console.log(`Playing cached sound for ${soundName}`);
            cachedSound.play();
            return;
        } catch (e) {
            // If cached sound is invalid, remove it and continue with normal flow
            console.log(`Cached sound for ${soundName} is invalid, removing from cache`);
            globalSoundCache.delete(soundName);
        }
    }

    // Always try to get/create a fresh sound object for the current scene
    const key = `${soundName}Sound`;

    // Check if the sound exists and is valid
    if (scene[key] && scene[key].scene === scene) {
        console.log(`Playing scene-local sound for ${soundName}`);
        scene[key].play();
        return;
    }

    // If sound doesn't exist or belongs to a different scene, create a new one
    if (scene.cache.audio.exists(soundName)) {
        // Audio is already loaded, create sound directly
        console.log(`Creating new sound for ${soundName} from existing audio cache`);
        scene[key] = scene.sound.add(soundName);
        globalSoundCache.set(soundName, scene[key]);
        scene[key].play();
    } else {
        // Audio needs to be loaded first
        console.log(`Loading audio for ${soundName}`);
        preloadSound(scene, soundName, (sound) => {
            console.log(`Playing newly loaded sound for ${soundName}`);
            sound?.play?.();
        });
    }
}
