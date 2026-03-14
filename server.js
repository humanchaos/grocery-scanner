/**
 * Grocery Scanner - Express Server
 * API endpoints for the multi-agent scanning pipeline.
 */

require('dotenv').config();

const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const Orchestrator = require('./agents/orchestrator');
const SecurityAgent = require('./agents/securityAgent');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required config
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
  console.error('\n❌ GEMINI_API_KEY is not set!');
  console.error('1. Get a free key from: https://aistudio.google.com/');
  console.error('2. Copy .env.example to .env');
  console.error('3. Paste your key in .env\n');
  process.exit(1);
}

// Initialize agents
const orchestrator = new Orchestrator({
  geminiApiKey: process.env.GEMINI_API_KEY,
  usdaApiKey: process.env.USDA_API_KEY || null,
});

const security = new SecurityAgent();

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting on scan endpoint
app.use('/api/scan', security.createRateLimiter());

// ─── API Routes ──────────────────────────────────────────

/**
 * POST /api/scan
 * Accepts a base64 image, runs the full agent pipeline.
 */
app.post('/api/scan', async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 New scan request received');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const result = await orchestrator.scan(image, (stage, message) => {
      console.log(`  [${stage}] ${message}`);
    });

    if (!result.success) {
      return res.status(422).json({
        error: result.error,
        stages: result.stages,
      });
    }

    // Strip raw image data from response to keep it lean
    const response = {
      success: true,
      products: result.products.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        confidence: p.confidence,
        boundingBox: p.boundingBox,
        verification: p.verification || { status: 'unknown' },
        health: p.health,
        nutrition: {
          source: p.nutrition.source,
          nutri_score: p.nutrition.nutri_score,
          nova_group: p.nutrition.nova_group,
          sugar_100g: p.nutrition.sugar_100g,
          saturated_fat_100g: p.nutrition.saturated_fat_100g,
          sodium_100g: p.nutrition.sodium_100g,
          fiber_100g: p.nutrition.fiber_100g,
          additives_count: p.nutrition.additives_count,
          data_quality: p.nutrition.data_quality,
        },
      })),
      overlayData: result.overlayData,
      uiConfig: result.uiConfig,
      timing: result.timing,
    };

    console.log(`\n✅ Scan complete: ${response.products.length} products analyzed in ${result.timing.total}ms`);
    res.json(response);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/health
 * Server health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    agents: [
      'SecurityAgent',
      'CameraAgent',
      'VisionAgent',
      'VerificationAgent',
      'NutritionAgent',
      'HealthAgent',
      'OverlayAgent',
      'UIAgent',
      'Orchestrator',
    ],
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasUsdaKey: !!process.env.USDA_API_KEY,
  });
});

// ─── Start Server ─────────────────────────────────────────

const HTTPS_PORT = 3443;

// Start HTTP server
app.listen(PORT, () => {
  console.log(`  HTTP  → http://localhost:${PORT}`);
});

// Start HTTPS server for mobile camera access
try {
  const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
  };
  https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
    // Get local IP for phone access
    const nets = require('os').networkInterfaces();
    let localIP = '<your-ip>';
    for (const iface of Object.values(nets)) {
      for (const net of iface) {
        if (net.family === 'IPv4' && !net.internal) {
          localIP = net.address;
          break;
        }
      }
    }

    console.log(`
╔════════════════════════════════════════════╗
║  🛒 Grocery Scanner - Multi-Agent System  ║
╠════════════════════════════════════════════╣
║                                            ║
║  Local:   http://localhost:${PORT}            ║
║  Phone:   https://${localIP}:${HTTPS_PORT}      ║
║  Agents:  8 active                         ║
║  Vision:  Gemini 2.0 Flash                 ║
║  Data:    Open Food Facts + USDA           ║
║                                            ║
╚════════════════════════════════════════════╝
    `);
  });
} catch (err) {
  console.warn('⚠️  HTTPS not available (missing cert.pem/key.pem)');
  console.warn('   Camera will only work on localhost.');
}
