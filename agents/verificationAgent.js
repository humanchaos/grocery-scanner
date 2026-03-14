/**
 * ✅ Verification Agent
 * Validates that products identified by the Vision Agent actually exist.
 * Cross-references product names/brands against Open Food Facts to filter out
 * hallucinated or misidentified products before they reach the Nutrition pipeline.
 *
 * Philosophy: If a product cannot be verified, it is flagged — never fabricated.
 */

class VerificationAgent {
  constructor() {
    this.name = 'VerificationAgent';
    this.offBaseUrl = 'https://world.openfoodfacts.org';
    this.userAgent = 'GroceryScanner/1.0 (grocery-scanner-app)';
    this.verificationCache = new Map();
  }

  /**
   * Verify a list of products detected by Vision.
   * Products that cannot be verified are flagged but NOT removed —
   * the user sees them marked as "unverified".
   *
   * @param {Array} products - Products from Vision Agent (after deduplication)
   * @returns {Array} Products with verification status added
   */
  async verify(products) {
    console.log(`[Verification] Verifying ${products.length} products against Open Food Facts...`);

    const verified = [];
    let confirmedCount = 0;
    let unverifiedCount = 0;

    const CONCURRENCY = 10;
    const queue = [...products];

    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const product = queue.shift();
        if (!product) break;

        const cacheKey = `${(product.brand || '').toLowerCase()}-${(product.name || '').toLowerCase()}`;

        // Check cache
        if (this.verificationCache.has(cacheKey)) {
          const cached = this.verificationCache.get(cacheKey);
          verified.push({ ...product, verification: cached });
          if (cached.status === 'verified') confirmedCount++;
          else unverifiedCount++;
          continue;
        }

        const result = await this.verifyProduct(product);
        this.verificationCache.set(cacheKey, result);
        verified.push({ ...product, verification: result });

        if (result.status === 'verified') confirmedCount++;
        else unverifiedCount++;
      }
    });

    await Promise.all(workers);

    console.log(`[Verification] Results: ${confirmedCount} verified, ${unverifiedCount} unverified`);
    return verified;
  }

  /**
   * Verify a single product by searching Open Food Facts.
   * A product is "verified" if we find a matching entry in the database.
   */
  async verifyProduct(product) {
    const { name, brand, barcode } = product;

    // Strategy 1: Barcode verification (highest confidence)
    if (barcode) {
      const barcodeResult = await this.checkBarcode(barcode);
      if (barcodeResult) {
        return {
          status: 'verified',
          confidence: 'high',
          method: 'barcode',
          matchedName: barcodeResult.product_name,
          matchedBrand: barcodeResult.brands,
          barcode: barcode,
        };
      }
    }

    // Strategy 2: Name + brand search verification
    const searchResult = await this.searchVerify(name, brand);
    if (searchResult) {
      return {
        status: 'verified',
        confidence: searchResult.confidence,
        method: 'name_search',
        matchedName: searchResult.matchedName,
        matchedBrand: searchResult.matchedBrand,
      };
    }

    // Product could not be verified — flag it
    console.log(`[Verification] ⚠ Could not verify: "${name}" by "${brand}"`);
    return {
      status: 'unverified',
      confidence: 'none',
      method: 'none',
      reason: 'Product not found in Open Food Facts database',
    };
  }

  /**
   * Check if a barcode exists in Open Food Facts
   */
  async checkBarcode(barcode) {
    try {
      const url = `${this.offBaseUrl}/api/v2/product/${barcode}.json?fields=product_name,brands`;
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, 'Accept': 'application/json' },
      });
      const data = await response.json();

      if (data.status === 1 && data.product) {
        return data.product;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Search Open Food Facts to verify a product exists.
   * Uses fuzzy matching to determine confidence level.
   */
  async searchVerify(name, brand) {
    try {
      // Try brand + name first
      const searchTerms = brand && brand !== 'Unknown'
        ? `${brand} ${name}`
        : name;

      const url = `${this.offBaseUrl}/cgi/search.pl?search_terms=${encodeURIComponent(searchTerms)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands`;
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, 'Accept': 'application/json' },
      });
      const data = await response.json();

      if (!data.products || data.products.length === 0) {
        // Fallback: try name only
        if (brand && brand !== 'Unknown') {
          return this.searchVerify(name, null);
        }
        return null;
      }

      // Check if any result is a reasonable match
      const match = this.findBestMatch(name, brand, data.products);
      return match;
    } catch {
      return null;
    }
  }

  /**
   * Find the best matching product from search results.
   * Returns null if no result is a reasonable match.
   */
  findBestMatch(searchName, searchBrand, products) {
    const normalize = (s) =>
      (s || '').toLowerCase()
        .replace(/[^a-zäöüß0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);

    const searchNameWords = new Set(normalize(searchName));
    const searchBrandWords = new Set(normalize(searchBrand));

    let bestMatch = null;
    let bestScore = 0;

    for (const product of products) {
      const productNameWords = normalize(product.product_name);
      const productBrandWords = normalize(product.brands);

      // Score name word overlap
      let nameMatches = 0;
      for (const word of productNameWords) {
        if (searchNameWords.has(word)) nameMatches++;
      }

      // Score brand word overlap
      let brandMatches = 0;
      for (const word of productBrandWords) {
        if (searchBrandWords.has(word)) brandMatches++;
      }

      const nameScore = searchNameWords.size > 0
        ? nameMatches / searchNameWords.size
        : 0;
      const brandScore = searchBrandWords.size > 0
        ? brandMatches / searchBrandWords.size
        : 0;

      // Combined score: name matters more
      const totalScore = nameScore * 0.7 + brandScore * 0.3;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMatch = {
          matchedName: product.product_name,
          matchedBrand: product.brands,
          score: totalScore,
        };
      }
    }

    if (!bestMatch || bestScore < 0.15) return null;

    // Assign confidence based on match score
    bestMatch.confidence = bestScore >= 0.5 ? 'high' : bestScore >= 0.25 ? 'medium' : 'low';

    return bestMatch;
  }
}

module.exports = VerificationAgent;
