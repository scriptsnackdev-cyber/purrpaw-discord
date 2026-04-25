const { loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

/**
 * Draws an image on canvas with "object-fit: cover" behavior
 * @param {CanvasRenderingContext2D} ctx 
 * @param {import('@napi-rs/canvas').Image} image 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 */
function drawImageCover(ctx, image, x, y, w, h) {
    const imgRatio = image.width / image.height;
    const canvasRatio = w / h;
    let sx, sy, sw, sh;

    if (imgRatio > canvasRatio) {
        // Image is wider than canvas
        sh = image.height;
        sw = image.height * canvasRatio;
        sx = (image.width - sw) / 2;
        sy = 0;
    } else {
        // Image is taller than canvas
        sw = image.width;
        sh = image.width / canvasRatio;
        sx = 0;
        sy = (image.height - sh) / 2;
    }

    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Loads and draws the guild's background (custom or default)
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} width 
 * @param {number} height 
 * @param {string|null} customURL 
 */
async function drawBackground(ctx, width, height, customURL = null) {
    try {
        if (customURL) {
            const background = await loadImage(customURL);
            drawImageCover(ctx, background, 0, 0, width, height);
            return true;
        }
    } catch (error) {
        console.error('Failed to load custom background:', error);
    }

    // Fallback to default
    const defaultBgPath = path.join(__dirname, '../assets/rank_bg.png');
    if (fs.existsSync(defaultBgPath)) {
        try {
            const background = await loadImage(defaultBgPath);
            drawImageCover(ctx, background, 0, 0, width, height);
            return true;
        } catch (error) {
            console.error('Failed to load default background:', error);
        }
    }

    // Final Fallback: Gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#2c2f33');
    gradient.addColorStop(1, '#23272a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return false;
}

module.exports = { drawImageCover, drawBackground };
