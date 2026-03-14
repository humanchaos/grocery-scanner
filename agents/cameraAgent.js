/**
 * 📸 Camera Agent
 * Preprocesses captured images: validates, resizes, strips metadata, optimizes for AI analysis.
 */

const sharp = require('sharp');

class CameraAgent {
  constructor() {
    this.name = 'CameraAgent';
    this.maxWidth = 1600;
    this.maxHeight = 1600;
    this.quality = 85;
  }

  /**
   * Process a raw image buffer into an optimized format for vision analysis
   * @param {Buffer} imageBuffer - Raw image data
   * @returns {{ success: boolean, image?: string, metadata?: object, error?: string }}
   */
  async process(imageBuffer) {
    try {
      // Get original metadata
      const metadata = await sharp(imageBuffer).metadata();

      console.log(`[Camera] Processing image: ${metadata.width}x${metadata.height} ${metadata.format}`);

      // Strip EXIF/metadata for privacy, resize if needed, convert to JPEG
      let pipeline = sharp(imageBuffer)
        .rotate() // Auto-rotate based on EXIF orientation before stripping
        .removeAlpha();

      // Resize only if larger than max dimensions
      if (metadata.width > this.maxWidth || metadata.height > this.maxHeight) {
        pipeline = pipeline.resize(this.maxWidth, this.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Convert to JPEG, strip all metadata
      const processedBuffer = await pipeline
        .jpeg({ quality: this.quality, mozjpeg: true })
        .toBuffer();

      const processedMetadata = await sharp(processedBuffer).metadata();

      // Convert to base64 for Gemini API
      const base64Image = processedBuffer.toString('base64');

      console.log(`[Camera] Processed: ${processedMetadata.width}x${processedMetadata.height}, ${(processedBuffer.length / 1024).toFixed(0)}KB`);

      return {
        success: true,
        image: base64Image,
        mimeType: 'image/jpeg',
        metadata: {
          originalWidth: metadata.width,
          originalHeight: metadata.height,
          processedWidth: processedMetadata.width,
          processedHeight: processedMetadata.height,
          originalSize: imageBuffer.length,
          processedSize: processedBuffer.length,
        },
      };
    } catch (err) {
      console.error(`[Camera] Processing error:`, err.message);
      return { success: false, error: `Image processing failed: ${err.message}` };
    }
  }
}

module.exports = CameraAgent;
