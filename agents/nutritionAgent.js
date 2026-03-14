/**
 * 🧠 Nutrition Expert Agent
 * Knows multiple nutrition databases and cross-references for the best data.
 * Sources: Open Food Facts (EU-optimized), USDA FoodData Central (optional).
 * Open Food Facts is a French-origin project with strongest coverage in Europe.
 *
 * IMPORTANT: Open Food Facts requires a User-Agent header and has a
 * rate limit of 10 search requests per minute.
 */

const fs = require('fs');
const path = require('path');

class NutritionAgent {
  constructor(usdaApiKey = null) {
    this.name = 'NutritionAgent';
    this.usdaApiKey = usdaApiKey;
    this.cachePath = path.join(__dirname, '..', 'data', 'nutrition_cache.json');
    this.cache = this.loadCache();
    this.offBaseUrl = 'https://world.openfoodfacts.org';
    // Required by Open Food Facts — requests without User-Agent are blocked
    this.userAgent = 'GroceryScanner/1.0 (grocery-scanner-app)';
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        console.log(`[Nutrition] Loading cache from ${this.cachePath}`);
        const data = fs.readFileSync(this.cachePath, 'utf8');
        return new Map(Object.entries(JSON.parse(data)));
      }
    } catch (e) {
      console.error('[Nutrition] Failed to load cache:', e.message);
    }
    return new Map();
  }

  saveCache() {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cachePath, JSON.stringify(Object.fromEntries(this.cache), null, 2), 'utf8');
    } catch (e) {
      console.error('[Nutrition] Failed to save cache:', e.message);
    }
  }

  /**
   * Fetch with required User-Agent header for Open Food Facts
   */
  async fetchOFF(url) {
    return fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Look up nutrition data for a list of identified products.
   * Uses parallel lookups with concurrency limit to respect OFF rate limits.
   */
  async lookup(products) {
    // Cap products to avoid excessive API calls
    const MAX_PRODUCTS = 40;
    if (products.length > MAX_PRODUCTS) {
      console.log(`[Nutrition] Capping from ${products.length} to ${MAX_PRODUCTS} products`);
      products = products.slice(0, MAX_PRODUCTS);
    }

    console.log(`[Nutrition] Looking up ${products.length} products (parallel, 15 concurrent)...`);

    const CONCURRENCY = 15;
    const enriched = [];
    let idx = 0;

    // Process in parallel batches
    const processProduct = async (product) => {
      const cacheKey = `${product.brand}-${product.name}`.toLowerCase();

      // Check cache first
      if (this.cache.has(cacheKey)) {
        return { ...product, nutrition: this.cache.get(cacheKey), verification: { status: 'verified', confidence: 'high', method: 'cache' } };
      }

      let nutrition = null;
      const lookupStart = Date.now();

      // Strategy 1: Barcode lookup
      if (product.barcode) {
        nutrition = await this.lookupByBarcode(product.barcode);
        if (nutrition) {
          nutrition.source = 'Open Food Facts (barcode)';
          nutrition.verified = true;
        }
      }

      // Strategy 2: OFF name search
      if (!nutrition) {
        nutrition = await this.searchOpenFoodFacts(product.name, product.brand);
        if (nutrition) {
          nutrition.source = 'Open Food Facts (search)';
          nutrition.verified = true;
        }
      }

      const lookupMs = Date.now() - lookupStart;
      const slowTag = lookupMs > 3000 ? ' ⏱️ SLOW' : '';
      console.log(`[Nutrition] ${nutrition ? '✓' : '✗'} "${product.name}" — ${lookupMs}ms${slowTag}`);

      if (nutrition) {
        this.cache.set(cacheKey, nutrition);
        this.saveCache();
        return {
          ...product,
          nutrition,
          verification: { status: 'verified', confidence: 'high', method: nutrition.source },
        };
      }

      // NO OFF MATCH → Use AI Estimations instead of dropping the product
      console.log(`[Nutrition] ⚠️ "${product.name}" falling back to AI estimations`);
      const fallbackNutrition = this.createEstimatedNutrition(product);
      return {
        ...product,
        nutrition: fallbackNutrition,
        verification: { status: 'estimated', confidence: 'low', method: 'AI Vision' },
      };
    };

    // Concurrency pool
    const queue = [...products];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const product = queue.shift();
        if (!product) break;
        const result = await processProduct(product);
        if (result) enriched.push(result);
      }
    });

    await Promise.all(workers);

    const verifiedCount = enriched.filter(p => p.verification.status === 'verified').length;
    console.log(`[Nutrition] ${verifiedCount}/${products.length} products verified in OFF, ${products.length - verifiedCount} AI estimated`);

    return enriched;
  }

  /**
   * Create estimated nutrition data from Vision AI pass
   */
  createEstimatedNutrition(product) {
    const est = product.estimated || {};
    
    // We map AI "low/moderate/high" strings to approximate numbers
    // so the health scoring logic still works without breaking, but we flag data_quality as 'estimated'
    return {
      product_name: product.name,
      brand: product.brand,
      nutri_score: est.nutri_score || 'c',
      nova_group: parseInt(est.nova_group) || 3,
      sugar_100g: est.sugar === 'high' ? 30 : (est.sugar === 'low' ? 3 : 10),
      fat_100g: est.fat === 'high' ? 30 : (est.fat === 'low' ? 3 : 10),
      saturated_fat_100g: est.fat === 'high' ? 15 : (est.fat === 'low' ? 1 : 5),
      sodium_100g: est.salt === 'high' ? 2 : (est.salt === 'low' ? 0.1 : 0.8),
      fiber_100g: est.fiber === 'high' ? 10 : (est.fiber === 'low' ? 1 : 4),
      additives_count: parseInt(est.nova_group) >= 4 ? 4 : 0, 
      additives: [],
      ingredients: 'Data estimated by AI visual analysis',
      data_quality: 'estimated', // Explicit flag for frontend
      estimated_levels: {
        sugar: est.sugar,
        fat: est.fat,
        salt: est.salt,
        fiber: est.fiber
      }
    };
  }

  /**
   * Strategy 1: Direct barcode lookup via Open Food Facts
   */
  async lookupByBarcode(barcode) {
    try {
      const url = `${this.offBaseUrl}/api/v2/product/${barcode}.json?fields=product_name,brands,nutriscore_grade,nova_group,nutriments,additives_tags,ingredients_text`;
      const response = await this.fetchOFF(url);
      const data = await response.json();

      if (data.status !== 1 || !data.product) return null;

      console.log(`[Nutrition] OFF barcode hit: ${data.product.product_name || barcode}`);
      return this.extractOpenFoodFactsData(data.product);
    } catch (err) {
      console.error(`[Nutrition] Barcode lookup error:`, err.message);
      return null;
    }
  }

  /**
   * Strategy 2: Name + brand search via Open Food Facts
   * Tries brand+name first, then name-only as fallback.
   */
  async searchOpenFoodFacts(name, brand) {
    // Try 1: brand + name (most specific)
    if (brand && brand !== 'Unknown') {
      const result = await this._offSearch(`${brand} ${name}`, name);
      if (result) return result;

      // Try 2: name only (broader match)
      const nameOnly = await this._offSearch(name, name);
      if (nameOnly) return nameOnly;
    } else {
      const result = await this._offSearch(name, name);
      if (result) return result;
    }

    return null;
  }

  /**
   * Execute a single OFF search query
   */
  async _offSearch(searchTerms, originalName) {
    try {
      const url = `${this.offBaseUrl}/cgi/search.pl?search_terms=${encodeURIComponent(searchTerms)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands,nutriscore_grade,nova_group,nutriments,additives_tags,ingredients_text,code`;
      const response = await this.fetchOFF(url);
      const data = await response.json();

      if (!data.products || data.products.length === 0) return null;

      // Pick the best match by comparing product names
      const best = this.pickBestOFFMatch(data.products, originalName);
      if (!best) return null;

      console.log(`[Nutrition] OFF search hit: "${originalName}" → "${best.product_name}"`);
      return this.extractOpenFoodFactsData(best);
    } catch (err) {
      console.error(`[Nutrition] OFF search error for "${searchTerms}":`, err.message);
      return null;
    }
  }

  /**
   * Pick the best matching product from OFF search results
   */
  pickBestOFFMatch(products, searchName) {
    if (!products || products.length === 0) return null;

    // Preserving German characters äöüß
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-zäöüß0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const stopWords = new Set(['bio', 'organic', 'the', 'and', 'with', 'von', 'und', 'mit', 'in', 'a', 'for', 'de', 'la', 'le', 'les', 'del', 'di']);
    const searchWords = new Set(normalize(searchName).filter(w => w.length > 1 && !stopWords.has(w)));

    if (searchWords.size === 0) return null;

    let bestProduct = null;
    let bestScore = -1;

    for (const product of products) {
      const productWords = normalize(product.product_name).filter(w => w.length > 1 && !stopWords.has(w));
      if (productWords.length === 0) continue;

      // Score: how many search words appear in product name
      const matches = productWords.filter(w => searchWords.has(w)).length;
      const score = matches / Math.max(searchWords.size, 1);

      // Also check if product has actual nutrition data
      const hasNutrition = product.nutriments && Object.keys(product.nutriments).length > 2;

      const finalScore = score + (hasNutrition ? 0.1 : 0);

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestProduct = product;
      }
    }

    // Require at least 30% word overlap — reject poor matches
    if (bestScore < 0.3) {
      console.warn(`[Nutrition] OFF match rejected: "${searchName}" → "${bestProduct?.product_name}" (score: ${bestScore.toFixed(2)})`);
      return null;
    }

    return bestProduct;
  }

  /**
   * Strategy 3: USDA FoodData Central search
   * NOTE: USDA FDC search API returns nutrient values per 100g for Branded foods.
   */
  async searchUSDA(name, brand) {
    if (!this.usdaApiKey) return null;

    try {
      const query = brand && brand !== 'Unknown' ? `${brand} ${name}` : name;
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${this.usdaApiKey}&query=${encodeURIComponent(query)}&pageSize=3&dataType=Branded`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.foods || data.foods.length === 0) return null;

      const food = data.foods[0];

      // Match quality check: reject if the USDA result doesn't resemble the search query.
      // European products often match to completely wrong American products.
      if (!this.isRelevantUSDAMatch(name, brand, food.description)) {
        console.warn(`[Nutrition] USDA match rejected: searched "${name}" → got "${food.description}"`);
        return null;
      }

      const nutrients = {};
      for (const n of food.foodNutrients || []) {
        nutrients[n.nutrientName] = n.value;
      }

      // USDA search results return values already per 100g — do NOT re-convert
      const sugar = nutrients['Sugars, total including NLEA'] ?? nutrients['Total Sugars'] ?? null;
      const fat = nutrients['Total lipid (fat)'] ?? null;
      const satFat = nutrients['Fatty acids, total saturated'] ?? null;
      const sodiumMg = nutrients['Sodium, Na'] ?? null; // already in mg per 100g
      const fiber = nutrients['Fiber, total dietary'] ?? null;

      const result = {
        product_name: food.description,
        brand: food.brandOwner || brand,
        nutri_score: null,
        nova_group: null,
        sugar_100g: sugar != null ? Math.round(sugar * 100) / 100 : null,
        fat_100g: fat != null ? Math.round(fat * 100) / 100 : null,
        saturated_fat_100g: satFat != null ? Math.round(satFat * 100) / 100 : null,
        sodium_100g: sodiumMg != null ? Math.round(sodiumMg / 10) / 100 : null, // mg → g per 100g
        fiber_100g: fiber != null ? Math.round(fiber * 100) / 100 : null,
        additives_count: 0,
        ingredients: food.ingredients || '',
        data_quality: 'partial',
      };

      // Sanity check — reject if values are physically impossible
      if (!this.isPlausible(result)) {
        console.warn(`[Nutrition] USDA data for "${name}" failed sanity check, discarding`);
        return null;
      }

      return result;
    } catch (err) {
      console.error(`[Nutrition] USDA search error:`, err.message);
      return null;
    }
  }

  /**
   * Extract and normalize nutrition data from Open Food Facts
   */
  extractOpenFoodFactsData(product) {
    const n = product.nutriments || {};

    const result = {
      product_name: product.product_name || '',
      brand: product.brands || '',
      nutri_score: product.nutriscore_grade || null,
      nova_group: product.nova_group || null,
      sugar_100g: n.sugars_100g ?? n['sugars_100g'] ?? null,
      fat_100g: n.fat_100g ?? null,
      saturated_fat_100g: n['saturated-fat_100g'] ?? null,
      sodium_100g: n.sodium_100g ?? null,
      fiber_100g: n.fiber_100g ?? null,
      additives_count: (product.additives_tags || []).length,
      additives: (product.additives_tags || []).map(a => a.replace('en:', '')),
      ingredients: product.ingredients_text || '',
      data_quality: 'full',
    };

    // Sanity check OFF data too
    if (!this.isPlausible(result)) {
      console.warn(`[Nutrition] OFF data for "${product.product_name}" failed sanity check`);
      result.data_quality = 'suspect';
    }

    return result;
  }

  /**
   * Check if a USDA search result is actually relevant to what we searched for.
   * Prevents returning data from completely wrong products.
   */
  isRelevantUSDAMatch(searchName, searchBrand, usdaDescription) {
    if (!usdaDescription) return false;

    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const stopWords = new Set(['bio', 'organic', 'the', 'and', 'with', 'von', 'und', 'mit', 'in', 'a', 'for']);

    const searchWords = normalize(`${searchName} ${searchBrand}`)
      .filter(w => w.length > 2 && !stopWords.has(w));
    const resultWords = new Set(normalize(usdaDescription));

    if (searchWords.length === 0) return false;

    const matches = searchWords.filter(w => resultWords.has(w)).length;
    const matchRatio = matches / searchWords.length;

    // Require at least 25% of significant words to match
    if (matchRatio < 0.25) return false;

    return true;
  }

  /**
   * Sanity check: ensure nutrition values are physically possible.
   * No single macronutrient can exceed 100g per 100g of product.
   * Sodium rarely exceeds 6g/100g even in pure salt scenarios.
   * @returns {boolean} true if data is plausible
   */
  isPlausible(nutrition) {
    const checks = [
      { key: 'sugar_100g', max: 100, label: 'sugar' },
      { key: 'fat_100g', max: 100, label: 'fat' },
      { key: 'saturated_fat_100g', max: 100, label: 'saturated fat' },
      { key: 'sodium_100g', max: 6, label: 'sodium' },
      { key: 'fiber_100g', max: 100, label: 'fiber' },
    ];

    for (const check of checks) {
      const value = nutrition[check.key];
      if (value != null && value > check.max) {
        console.warn(`[Nutrition] Implausible ${check.label}: ${value}g/100g (max ${check.max})`);
        return false;
      }
    }

    return true;
  }

  /**
   * Create a placeholder for products with no nutrition data
   */
  createUnknownNutrition(product) {
    return {
      product_name: product.name,
      brand: product.brand,
      nutri_score: null,
      nova_group: null,
      sugar_100g: null,
      fat_100g: null,
      saturated_fat_100g: null,
      sodium_100g: null,
      fiber_100g: null,
      additives_count: null,
      additives: [],
      ingredients: '',
      data_quality: 'none',
    };
  }
}

module.exports = NutritionAgent;

