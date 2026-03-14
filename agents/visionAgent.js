/**
 * 🔍 Vision Agent
 * Uses Google Gemini 2.5 Flash Vision API to identify products on grocery shelves.
 * Single-pass: 2.5 Flash is powerful enough to find 40-60+ products in one pass.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class VisionAgent {
  constructor(apiKey) {
    this.name = 'VisionAgent';
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192
      }
    });
  }

  /**
   * Analyze a shelf image and identify all visible products (slicing enabled)
   */
  async analyze(base64Image, mimeType = 'image/jpeg') {
    try {
      console.log('[Vision] Analyzing shelf image with Gemini 2.5 Flash (3x3 Slicing Enabled)...');
      const start = Date.now();
      const sharp = require('sharp');
      const promptLoader = require('./promptLoader');
      const defaultPrompt = `You are a detailed grocery product identification expert.`;
      const prompt = promptLoader.getPrompt('Vision Agent', defaultPrompt);

      const buffer = Buffer.from(base64Image, 'base64');
      const metadata = await sharp(buffer).metadata();
      const { width, height } = metadata;

      // Calculate 3x3 grid dimensions
      const sliceWidth = Math.floor(width / 3);
      const sliceHeight = Math.floor(height / 3);
      
      const tiles = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const left = col * sliceWidth;
          const top = row * sliceHeight;
          const w = (col === 2) ? width - left : sliceWidth;
          const h = (row === 2) ? height - top : sliceHeight;

          const tileBuffer = await sharp(buffer)
            .extract({ left, top, width: w, height: h })
            .jpeg()
            .toBuffer();

          tiles.push({
            buffer: tileBuffer,
            r: {
              ox: left / width,
              oy: top / height,
              sx: w / width,
              sy: h / height
            }
          });
        }
      }

      console.log(`[Vision] Extracted ${tiles.length} high-res tiles. Analyzing...`);

      let allProducts = [];
      let globalId = 0;

      // We process them in parallel for maximum speed
      console.log('[Vision] Sending tiles to Gemini API in parallel...');
      await Promise.all(tiles.map(async (tile, idx) => {
        try {
          const result = await this.model.generateContent([
            prompt,
            { inlineData: { mimeType: 'image/jpeg', data: tile.buffer.toString('base64') } },
          ]);

          const response = result.response.text();
          let jsonStr = response;
          const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();
          
          let products = [];
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.objects && Array.isArray(parsed.objects)) {
              products = parsed.objects;
            } else if (Array.isArray(parsed)) {
              products = parsed;
            }
          } catch (e) {
            const finishReason = result.response.candidates?.[0]?.finishReason;
            console.warn(`[Vision] JSON Parse error for tile ${idx+1}. Attempting salvage... Finish Reason: ${finishReason}`);
            
            // Salvage complete objects from the truncated string
            const arrayStart = jsonStr.indexOf('[');
            if (arrayStart !== -1) {
              const arrayStr = jsonStr.substring(arrayStart + 1);
              let depth = 0, inString = false, escapeNext = false, startIndex = -1;
              for (let i = 0; i < arrayStr.length; i++) {
                const char = arrayStr[i];
                if (escapeNext) { escapeNext = false; continue; }
                if (char === '\\') { escapeNext = true; continue; }
                if (char === '"') { inString = !inString; continue; }
                if (!inString) {
                  if (char === '{') {
                    if (depth === 0) startIndex = i;
                    depth++;
                  } else if (char === '}') {
                    depth--;
                    if (depth === 0 && startIndex !== -1) {
                      try {
                        const objStr = arrayStr.substring(startIndex, i + 1);
                        if (objStr.includes('"name"')) products.push(JSON.parse(objStr));
                      } catch(err) {}
                      startIndex = -1;
                    }
                  }
                }
              }
            }
            console.log(`[Vision] Salvaged ${products.length} products from tile ${idx+1}.`);
          }

          products.forEach(p => {
             // adjust bounding box to global space using 3x3 offsets
             if (p.boundingBox) {
               p.boundingBox.x = (p.boundingBox.x * tile.r.sx) + tile.r.ox;
               p.boundingBox.y = (p.boundingBox.y * tile.r.sy) + tile.r.oy;
               p.boundingBox.width = p.boundingBox.width * tile.r.sx;
               p.boundingBox.height = p.boundingBox.height * tile.r.sy;
             }
             
             // adjust center_xy to global space if it exists
             if (p.center_xy && Array.isArray(p.center_xy) && p.center_xy.length >= 2) {
               p.center_xy[0] = (p.center_xy[0] * tile.r.sx) + tile.r.ox;
               p.center_xy[1] = (p.center_xy[1] * tile.r.sy) + tile.r.oy;
             }
             
             let bb = p.boundingBox || null;
             allProducts.push({
                ...p,
                id: globalId++,
                name: p.name || 'Unknown Product',
                brand: p.brand || 'Unknown',
                barcode: null,
                category: p.category || 'other',
                confidence: p.confidence || 'high',
                boundingBox: bb ? {
                  x: Math.max(0, Math.min(1, bb.x)),
                  y: Math.max(0, Math.min(1, bb.y)),
                  width: Math.max(0.02, Math.min(1, bb.width)),
                  height: Math.max(0.02, Math.min(1, bb.height)),
                } : null,
                estimated: {
                  nutri_score: (p.estimated_nutri_score || 'c').toLowerCase(),
                  nova_group: p.estimated_nova_group || 3,
                  sugar: (p.estimated_sugar || 'moderate').toLowerCase(),
                  fat: (p.estimated_fat || 'moderate').toLowerCase(),
                  salt: (p.estimated_salt || 'moderate').toLowerCase(),
                  fiber: (p.estimated_fiber || 'moderate').toLowerCase(),
                }
             });
          });
          console.log(`[Vision] Tile ${idx+1} completed with ${products.length} products.`);
        } catch(e) {
          console.error(`[Vision] Error processing tile ${idx+1}:`, e.message);
        }
      }));

      console.log(`[Vision] Found ${allProducts.length} total products in ${Date.now() - start}ms`);
      return { success: true, products: allProducts };
    } catch (err) {
      console.error('[Vision] Analysis error:', err.message);
      return { success: false, error: `Vision analysis failed: ${err.message}` };
    }
  }
}

module.exports = VisionAgent;
