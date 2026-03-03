import sharp from 'sharp';
import jsQR from 'jsqr';

/**
 * Decode a QR code from a raw image buffer.
 * Uses sharp to convert the image to raw RGBA pixel data,
 * then uses jsQR to scan for a QR code.
 *
 * We do NOT trust Gemini Vision to read QR codes — this is the authoritative source.
 */
export async function decodeQRFromBuffer(imageBuffer: Buffer): Promise<string | null> {
    try {
        const { data, info } = await sharp(imageBuffer)
            .rotate()               // honour EXIF orientation
            .ensureAlpha()          // jsQR requires RGBA (4 channels)
            .raw()
            .toBuffer({ resolveWithObject: true });

        const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);

        if (code) {
            console.log(`[QRDecoder] Decoded QR: ${code.data}`);
            return code.data;
        }

        // jsQR failed on full image — try a cropped top-right region (where QR is printed)
        const topRightData = await sharp(imageBuffer)
            .rotate()
            .extract({
                left: Math.floor(info.width * 0.65),
                top: 0,
                width: Math.floor(info.width * 0.35),
                height: Math.floor(info.height * 0.2),
            })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const croppedCode = jsQR(
            new Uint8ClampedArray(topRightData.data),
            topRightData.info.width,
            topRightData.info.height
        );

        if (croppedCode) {
            console.log(`[QRDecoder] Decoded QR from cropped region: ${croppedCode.data}`);
            return croppedCode.data;
        }

        console.warn('[QRDecoder] No QR code found in image');
        return null;
    } catch (error: any) {
        console.error('[QRDecoder] Error during QR decoding:', error.message);
        return null;
    }
}
