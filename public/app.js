/**
 * Grocery Scanner — Frontend Application
 * Handles camera, scanning, overlay rendering, and result display.
 */

(function () {
  'use strict';

  // ─── DOM Elements ──────────────────────────────
  const $ = (id) => document.getElementById(id);
  const loadingScreen = $('loadingScreen');
  const app = $('app');
  const cameraSection = $('cameraSection');
  const resultsSection = $('resultsSection');
  const cameraFeed = $('cameraFeed');
  const overlayCanvas = $('overlayCanvas');
  const resultCanvas = $('resultCanvas');
  const captureBtn = $('captureBtn');
  const backBtn = $('backBtn');
  const fileInput = $('fileInput');
  const scanAnimation = $('scanAnimation');
  const scanStatusText = $('scanStatusText');
  const scanProgressFill = $('scanProgressFill');
  const langSelector = $('langSelector');
  const statsBar = $('statsBar');
  const productCards = $('productCards');
  const timingInfo = $('timingInfo');
  const errorToast = $('errorToast');
  const errorText = $('errorText');
  const errorClose = $('errorClose');
  const downloadBtn = $('downloadBtn');

  let stream = null;
  let lastScanData = null;
  let capturedImageData = null;
  let currentLang = 'en';

  // ─── Translations ────────────────────────────────
  const i18n = {
    en: {
      scanning: 'Scanning...', security: 'Validating image...', camera: 'Processing image...',
      vision: 'Identifying products...', nutrition: 'Looking up nutrition data...',
      health: 'Evaluating health...', done: 'Done!',
      showDetails: 'Show details ▸', hideDetails: 'Hide details ▾',
      whatMeans: '💡 What does this mean for me?', hideImpact: '💡 Hide health info',
      scanAgain: '← Scan Again', download: '📄 Download Results',
      captureHint: 'Point at shelf & tap to scan', orUpload: 'Or upload an image',
      healthy: 'Healthy', moderate: 'Moderate', unhealthy: 'Unhealthy', noData: 'No Data',
      source: 'Source',
      impact_sugar: '🧠 Sugar impairs focus and memory. It spikes blood sugar, causing energy crashes and long-term brain fog.',
      impact_fat: '❤️ Saturated fat raises LDL cholesterol, increasing risk of heart disease and stroke.',
      impact_sodium: '💧 Excess salt raises blood pressure, strains kidneys, and increases heart attack risk.',
      impact_processed: '⚗️ Ultra-processed foods contain industrial additives linked to inflammation, obesity, and gut damage.',
      impact_additives: '🧪 Many additives are linked to hyperactivity in children and allergic reactions in sensitive individuals.',
      impact_fiber: '🌿 Fiber feeds healthy gut bacteria, helps control blood sugar, and keeps you feeling full longer.',
    },
    de: {
      scanning: 'Scanne...', security: 'Bild wird überprüft...', camera: 'Bild wird verarbeitet...',
      vision: 'Produkte werden erkannt...', nutrition: 'Nährwerte werden gesucht...',
      health: 'Gesundheit wird bewertet...', done: 'Fertig!',
      showDetails: 'Details zeigen ▸', hideDetails: 'Details ausblenden ▾',
      whatMeans: '💡 Was bedeutet das für mich?', hideImpact: '💡 Gesundheitsinfo ausblenden',
      scanAgain: '← Erneut scannen', download: '📄 Ergebnisse herunterladen',
      captureHint: 'Auf Regal zeigen & tippen', orUpload: 'Oder Bild hochladen',
      healthy: 'Gesund', moderate: 'Mäßig', unhealthy: 'Ungesund', noData: 'Keine Daten',
      source: 'Quelle',
      impact_sugar: '🧠 Zucker beeinträchtigt Konzentration und Gedächtnis. Er verursacht Blutzuckerspitzen und langfristig Gehirnnebel.',
      impact_fat: '❤️ Gesättigte Fette erhöhen LDL-Cholesterin und das Risiko für Herzerkrankungen und Schlaganfall.',
      impact_sodium: '💧 Zu viel Salz erhöht den Blutdruck, belastet die Nieren und erhöht das Herzinfarktrisiko.',
      impact_processed: '⚗️ Hochverarbeitete Lebensmittel enthalten industrielle Zusätze die mit Entzündungen, Übergewicht und Darmschäden in Verbindung stehen.',
      impact_additives: '🧪 Viele Zusatzstoffe werden mit Hyperaktivität bei Kindern und allergischen Reaktionen in Verbindung gebracht.',
      impact_fiber: '🌿 Ballaststoffe füttern gesunde Darmbakterien, helfen bei der Blutzuckerkontrolle und sättigen länger.',
    },
    fr: {
      scanning: 'Analyse...', security: 'Validation de l\'image...', camera: 'Traitement de l\'image...',
      vision: 'Identification des produits...', nutrition: 'Recherche des valeurs nutritives...',
      health: 'Évaluation santé...', done: 'Terminé!',
      showDetails: 'Voir détails ▸', hideDetails: 'Masquer détails ▾',
      whatMeans: '💡 Qu\'est-ce que ça veut dire pour moi?', hideImpact: '💡 Masquer les infos santé',
      scanAgain: '← Rescanner', download: '📄 Télécharger les résultats',
      captureHint: 'Pointez le rayon & appuyez', orUpload: 'Ou téléversez une image',
      healthy: 'Sain', moderate: 'Moyen', unhealthy: 'Mauvais', noData: 'Pas de données',
      source: 'Source',
      impact_sugar: '🧠 Le sucre altère la concentration et la mémoire. Il provoque des pics glycémiques et un brouillard cérébral.',
      impact_fat: '❤️ Les graisses saturées augmentent le cholestérol LDL et le risque de maladies cardiovasculaires.',
      impact_sodium: '💧 L\'excès de sel augmente la pression artérielle et le risque cardiaque.',
      impact_processed: '⚗️ Les aliments ultra-transformés contiennent des additifs liés à l\'inflammation et l\'obésité.',
      impact_additives: '🧪 De nombreux additifs sont liés à l\'hyperactivité chez les enfants.',
      impact_fiber: '🌿 Les fibres nourrissent les bonnes bactéries intestinales et aident à contrôler la glycémie.',
    },
    es: {
      scanning: 'Escaneando...', security: 'Validando imagen...', camera: 'Procesando imagen...',
      vision: 'Identificando productos...', nutrition: 'Buscando datos nutricionales...',
      health: 'Evaluando salud...', done: '¡Listo!',
      showDetails: 'Ver detalles ▸', hideDetails: 'Ocultar detalles ▾',
      whatMeans: '💡 ¿Qué significa para mí?', hideImpact: '💡 Ocultar info de salud',
      scanAgain: '← Escanear de nuevo', download: '📄 Descargar resultados',
      captureHint: 'Apunta al estante y toca', orUpload: 'O sube una imagen',
      healthy: 'Saludable', moderate: 'Moderado', unhealthy: 'No saludable', noData: 'Sin datos',
      source: 'Fuente',
      impact_sugar: '🧠 El azúcar afecta la concentración y la memoria, causando picos de glucosa y fatiga cerebral.',
      impact_fat: '❤️ Las grasas saturadas elevan el colesterol LDL, aumentando el riesgo cardiovascular.',
      impact_sodium: '💧 El exceso de sal sube la presión arterial y daña los riñones.',
      impact_processed: '⚗️ Los ultraprocesados contienen aditivos vinculados a inflamación y obesidad.',
      impact_additives: '🧪 Muchos aditivos se asocian con hiperactividad en niños.',
      impact_fiber: '🌿 La fibra alimenta bacterias intestinales buenas y ayuda a controlar el azúcar en sangre.',
    },
    it: {
      scanning: 'Scansione...', security: 'Validazione immagine...', camera: 'Elaborazione immagine...',
      vision: 'Identificazione prodotti...', nutrition: 'Ricerca dati nutrizionali...',
      health: 'Valutazione salute...', done: 'Fatto!',
      showDetails: 'Mostra dettagli ▸', hideDetails: 'Nascondi dettagli ▾',
      whatMeans: '💡 Cosa significa per me?', hideImpact: '💡 Nascondi info salute',
      scanAgain: '← Scansiona di nuovo', download: '📄 Scarica risultati',
      captureHint: 'Inquadra lo scaffale e tocca', orUpload: 'O carica un\'immagine',
      healthy: 'Sano', moderate: 'Moderato', unhealthy: 'Non sano', noData: 'Nessun dato',
      source: 'Fonte',
      impact_sugar: '🧠 Lo zucchero compromette concentrazione e memoria, causando picchi glicemici e affaticamento.',
      impact_fat: '❤️ I grassi saturi alzano il colesterolo LDL, aumentando il rischio cardiovascolare.',
      impact_sodium: '💧 Il sale in eccesso alza la pressione e danneggia i reni.',
      impact_processed: '⚗️ Gli ultra-processati contengono additivi legati a infiammazione e obesità.',
      impact_additives: '🧪 Molti additivi sono collegati all\'iperattività nei bambini.',
      impact_fiber: '🌿 La fibra nutre i batteri intestinali buoni e controlla la glicemia.',
    },
    nl: {
      scanning: 'Scannen...', security: 'Afbeelding valideren...', camera: 'Afbeelding verwerken...',
      vision: 'Producten herkennen...', nutrition: 'Voedingswaarden opzoeken...',
      health: 'Gezondheid beoordelen...', done: 'Klaar!',
      showDetails: 'Details tonen ▸', hideDetails: 'Details verbergen ▾',
      whatMeans: '💡 Wat betekent dit voor mij?', hideImpact: '💡 Info verbergen',
      scanAgain: '← Opnieuw scannen', download: '📄 Resultaten downloaden',
      captureHint: 'Richt op schap en tik', orUpload: 'Of upload een afbeelding',
      healthy: 'Gezond', moderate: 'Matig', unhealthy: 'Ongezond', noData: 'Geen data',
      source: 'Bron',
      impact_sugar: '🧠 Suiker verstoort concentratie en geheugen door bloedsuikerpieken.',
      impact_fat: '❤️ Verzadigd vet verhoogt LDL-cholesterol en het risico op hartziekten.',
      impact_sodium: '💧 Te veel zout verhoogt de bloeddruk en belast de nieren.',
      impact_processed: '⚗️ Ultrabewerkte voedingsmiddelen bevatten additieven gelinkt aan ontsteking.',
      impact_additives: '🧪 Veel additieven zijn gelinkt aan hyperactiviteit bij kinderen.',
      impact_fiber: '🌿 Vezels voeden gezonde darmbacteriën en helpen bij bloedsuikercontrole.',
    },
    pt: {
      scanning: 'A analisar...', security: 'A validar imagem...', camera: 'A processar imagem...',
      vision: 'A identificar produtos...', nutrition: 'A procurar dados nutricionais...',
      health: 'A avaliar saúde...', done: 'Pronto!',
      showDetails: 'Ver detalhes ▸', hideDetails: 'Ocultar detalhes ▾',
      whatMeans: '💡 O que isto significa para mim?', hideImpact: '💡 Ocultar info de saúde',
      scanAgain: '← Digitalizar novamente', download: '📄 Descarregar resultados',
      captureHint: 'Aponte para a prateleira', orUpload: 'Ou carregue uma imagem',
      healthy: 'Saudável', moderate: 'Moderado', unhealthy: 'Não saudável', noData: 'Sem dados',
      source: 'Fonte',
      impact_sugar: '🧠 O açúcar prejudica a concentração e memória, causando picos de glicose.',
      impact_fat: '❤️ As gorduras saturadas aumentam o colesterol LDL e o risco cardiovascular.',
      impact_sodium: '💧 O excesso de sal sobe a pressão arterial e prejudica os rins.',
      impact_processed: '⚗️ Alimentos ultraprocessados contêm aditivos ligados à inflamação e obesidade.',
      impact_additives: '🧪 Muitos aditivos estão ligados à hiperatividade em crianças.',
      impact_fiber: '🌿 A fibra alimenta bactérias intestinais boas e controla a glicemia.',
    },
    pl: {
      scanning: 'Skanowanie...', security: 'Walidacja obrazu...', camera: 'Przetwarzanie obrazu...',
      vision: 'Identyfikacja produktów...', nutrition: 'Wyszukiwanie danych...', 
      health: 'Ocena zdrowotna...', done: 'Gotowe!',
      showDetails: 'Pokaż szczegóły ▸', hideDetails: 'Ukryj szczegóły ▾',
      whatMeans: '💡 Co to dla mnie znaczy?', hideImpact: '💡 Ukryj info zdrowotne',
      scanAgain: '← Skanuj ponownie', download: '📄 Pobierz wyniki',
      captureHint: 'Skieruj na półkę i dotknij', orUpload: 'Lub prześlij zdjęcie',
      healthy: 'Zdrowy', moderate: 'Umiarkowany', unhealthy: 'Niezdrowy', noData: 'Brak danych',
      source: 'Źródło',
      impact_sugar: '🧠 Cukier upośledza koncentrację i pamięć, powodując skoki glukozy.',
      impact_fat: '❤️ Tłuszcze nasycone podnoszą cholesterol LDL i ryzyko chorób serca.',
      impact_sodium: '💧 Nadmiar soli podnosi ciśnienie i obciąża nerki.',
      impact_processed: '⚗️ Żywność ultraprzetworzona zawiera dodatki powiązane z otyłością.',
      impact_additives: '🧪 Wiele dodatków jest powiązanych z nadpobudliwością u dzieci.',
      impact_fiber: '🌿 Błonnik karmi dobre bakterie jelitowe i kontroluje poziom cukru we krwi.',
    },
    sv: {
      scanning: 'Skannar...', security: 'Validerar bild...', camera: 'Bearbetar bild...',
      vision: 'Identifierar produkter...', nutrition: 'Söker näringsvärden...',
      health: 'Utvärderar hälsa...', done: 'Klart!',
      showDetails: 'Visa detaljer ▸', hideDetails: 'Dölj detaljer ▾',
      whatMeans: '💡 Vad betyder detta för mig?', hideImpact: '💡 Dölj hälsoinfo',
      scanAgain: '← Skanna igen', download: '📄 Ladda ner resultat',
      captureHint: 'Rikta mot hyllan och tryck', orUpload: 'Eller ladda upp en bild',
      healthy: 'Hälsosam', moderate: 'Måttlig', unhealthy: 'Ohälsosam', noData: 'Ingen data',
      source: 'Källa',
      impact_sugar: '🧠 Socker försämrar koncentration och minne genom blodsockertoppar.',
      impact_fat: '❤️ Mättat fett höjer LDL-kolesterol och risken för hjärtsjukdom.',
      impact_sodium: '💧 För mycket salt höjer blodtrycket och belastar njurarna.',
      impact_processed: '⚗️ Ultraprocessad mat innehåller tillsatser kopplade till inflammation.',
      impact_additives: '🧪 Många tillsatser är kopplade till hyperaktivitet hos barn.',
      impact_fiber: '🌿 Fiber ger näring till nyttiga tarmbakterier och kontrollerar blodsockret.',
    },
  };

  function t(key) { return (i18n[currentLang] || i18n.en)[key] || i18n.en[key] || key; }

  // ─── Health Impact Content ───────────────────────
  function getHealthImpacts(nutrition) {
    const impacts = [];
    if (nutrition.sugar_100g > 5) impacts.push('sugar');
    if (nutrition.saturated_fat_100g > 2) impacts.push('fat');
    if (nutrition.sodium_100g != null && nutrition.sodium_100g * 1000 > 300) impacts.push('sodium');
    if (nutrition.nova_group >= 3) impacts.push('processed');
    if (nutrition.additives_count > 3) impacts.push('additives');
    if (nutrition.fiber_100g >= 6) impacts.push('fiber');
    return impacts;
  }

  function renderHealthImpacts(impacts) {
    if (impacts.length === 0) return '';
    return impacts.map(key =>
      `<div class="impact-item"><span class="impact-icon">${t('impact_' + key).charAt(0)}</span><span>${t('impact_' + key).substring(2)}</span></div>`
    ).join('');
  }

  // ─── Progress Bar ────────────────────────────────
  function updateProgress(percent, statusKey) {
    if (scanProgressFill) scanProgressFill.style.width = percent + '%';
    if (scanStatusText) scanStatusText.textContent = t(statusKey);
  }

  // ─── Initialize ────────────────────────────────
  async function init() {
    try {
      await startCamera();
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.classList.add('hidden');
        app.classList.remove('hidden');
      }, 500);
    } catch (err) {
      console.error('Camera init failed:', err);
      // Still show the app — user can upload a file
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.classList.add('hidden');
        app.classList.remove('hidden');
      }, 500);
    }

    // Event listeners
    captureBtn.addEventListener('click', handleCapture);
    backBtn.addEventListener('click', handleBack);
    fileInput.addEventListener('change', handleFileUpload);
    downloadBtn.addEventListener('click', handleDownload);
    errorClose.addEventListener('click', () => errorToast.classList.add('hidden'));

    // View results button
    viewResultsBtn.addEventListener('click', () => {
      if (lastScanData) {
        showResults(lastScanData, capturedImageData);
      }
    });

    // Language selector
    currentLang = localStorage.getItem('groceryScanLang') || 'en';
    langSelector.value = currentLang;
    langSelector.addEventListener('change', () => {
      currentLang = langSelector.value;
      localStorage.setItem('groceryScanLang', currentLang);
      // Re-render results if available
      if (lastScanData) {
        renderProductCards(lastScanData.products, lastScanData.uiConfig);
      }
    });
  }

  // ─── Camera ────────────────────────────────────
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // rear camera
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      cameraFeed.srcObject = stream;
      await cameraFeed.play();
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err.message);
      throw err;
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  // ─── DOM: Queue Elements ────────────────────────
  const queueBadge = $('queueBadge');
  const viewResultsBtn = $('viewResultsBtn');
  const resultCount = $('resultCount');
  const captureHint = $('captureHint');
  const scanQueueList = $('scanQueueList');
  const queueThumbnails = $('queueThumbnails');

  let scanQueue = [];
  let isProcessing = false;
  let allResults = [];  // accumulated results across scans

  // ─── Capture Image ────────────────────────────
  async function handleCapture() {
    if (!cameraFeed.srcObject && !cameraFeed.videoWidth) {
      showError('Camera not available. Try uploading an image instead.');
      return;
    }

    // Capture frame from video
    const canvas = document.createElement('canvas');
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraFeed, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);

    // Flash feedback
    const flash = document.createElement('div');
    flash.className = 'capture-flash';
    document.querySelector('.camera-container').appendChild(flash);
    setTimeout(() => flash.remove(), 350);

    // Add to queue and process
    scanQueue.push(imageData);
    updateQueueUI();
    captureHint.textContent = t('scanning') + ` (${scanQueue.length} in queue)`;

    if (!isProcessing) {
      processQueue();
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      scanQueue.push(ev.target.result);
      updateQueueUI();
      if (!isProcessing) {
        processQueue();
      }
    };
    reader.readAsDataURL(file);
  }

  // ─── Queue Processing ─────────────────────────
  function updateQueueUI(currentImageData = null) {
    const pending = scanQueue.length;
    const totalProcessing = pending + (currentImageData ? 1 : 0);
    
    if (totalProcessing > 0) {
      queueBadge.textContent = totalProcessing;
      queueBadge.classList.remove('hidden');
      scanQueueList.classList.remove('hidden');
    } else {
      queueBadge.classList.add('hidden');
      scanQueueList.classList.add('hidden');
    }

    // Render thumbnails
    queueThumbnails.innerHTML = '';
    
    // Add actively processing item first
    if (currentImageData) {
      const img = document.createElement('img');
      img.src = currentImageData;
      img.className = 'queue-thumbnail active';
      queueThumbnails.appendChild(img);
    }
    
    // Add pending items
    scanQueue.forEach(imgData => {
      const img = document.createElement('img');
      img.src = imgData;
      img.className = 'queue-thumbnail';
      queueThumbnails.appendChild(img);
    });
  }

  async function processQueue() {
    if (isProcessing || scanQueue.length === 0) return;
    isProcessing = true;

    while (scanQueue.length > 0) {
      const imageData = scanQueue.shift();
      updateQueueUI(imageData);

      // Show progress overlay on camera
      scanAnimation.classList.remove('hidden');
      updateProgress(5, 'security');

      // Simulate progressive stages (tuned for optimized pipeline)
      const stageTimers = [
        setTimeout(() => updateProgress(10, 'camera'), 200),
        setTimeout(() => updateProgress(20, 'vision'), 500),
        setTimeout(() => updateProgress(35, 'vision'), 5000),
        setTimeout(() => updateProgress(50, 'nutrition'), 10000),
        setTimeout(() => updateProgress(65, 'nutrition'), 20000),
        setTimeout(() => updateProgress(80, 'nutrition'), 30000),
        setTimeout(() => updateProgress(90, 'health'), 40000),
      ];

      try {
        console.log('%c🔍 Scan started...', 'color: #818cf8; font-weight: bold');
        const scanStart = performance.now();

        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageData }),
        });

        stageTimers.forEach(clearTimeout);
        updateProgress(100, 'done');

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Scan failed');
        }

        // Log timing breakdown to browser console
        const totalSec = ((performance.now() - scanStart) / 1000).toFixed(1);
        console.group(`%c✅ Scan complete — ${totalSec}s — ${data.products.length} products`, 'color: #22c55e; font-weight: bold; font-size: 13px');
        if (data.timing) {
          const stages = [
            { key: 'security', icon: '🔒', label: 'Security' },
            { key: 'camera', icon: '📸', label: 'Camera' },
            { key: 'vision', icon: '🔍', label: 'Vision (multi-pass)' },
            { key: 'nutrition', icon: '🧠', label: 'Nutrition lookup' },
            { key: 'health', icon: '💚', label: 'Health evaluation' },
            { key: 'overlay', icon: '🎨', label: 'Overlay' },
            { key: 'ui', icon: '📊', label: 'UI config' },
          ];
          for (const s of stages) {
            const ms = data.timing[s.key];
            if (ms == null) continue;
            const sec = (ms / 1000).toFixed(1);
            const slow = ms > 5000 ? ' ⏱️ SLOW' : '';
            const color = ms > 5000 ? 'color: #ef4444' : 'color: #94a3b8';
            console.log(`%c${s.icon} ${s.label}: ${sec}s${slow}`, color);
          }
        }
        console.log(`%c📦 Products: ${data.products.length} verified (OFF-matched)`, 'color: #818cf8');
        console.groupEnd();

        // Accumulate results
        capturedImageData = imageData;
        mergeResults(data);

        await new Promise(r => setTimeout(r, 400));

      } catch (err) {
        stageTimers.forEach(clearTimeout);
        console.error('Scan error:', err);
        showError(err.message || 'Failed to scan. Please try again.');
      }
    }

    // All queue items processed
    updateQueueUI(null);
    scanAnimation.classList.add('hidden');
    if (scanProgressFill) scanProgressFill.style.width = '0%';
    isProcessing = false;
    captureHint.textContent = t('captureHint');

    // If user is still on camera view, show view-results button
    if (!resultsSection.classList.contains('hidden')) return;
    if (allResults.length > 0) {
      showResults(lastScanData, capturedImageData);
    }
  }

  function mergeResults(newData) {
    if (!lastScanData) {
      lastScanData = newData;
      allResults = [...newData.products];
    } else {
      // Merge new products into existing results (avoid duplicates by name+brand)
      const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const np of newData.products) {
        const exists = allResults.some(ep =>
          normalize(ep.name) === normalize(np.name) && normalize(ep.brand) === normalize(np.brand)
        );
        if (!exists) {
          np.id = allResults.length;
          allResults.push(np);
        }
      }

      // Update combined data
      lastScanData = {
        ...newData,
        products: allResults,
        uiConfig: {
          ...newData.uiConfig,
          stats: {
            total: allResults.length,
            healthy: allResults.filter(p => p.health?.verdict === 'healthy').length,
            moderate: allResults.filter(p => p.health?.verdict === 'moderate').length,
            unhealthy: allResults.filter(p => p.health?.verdict === 'unhealthy').length,
          },
        },
      };
    }

    // Update view-results button
    resultCount.textContent = allResults.length;
    viewResultsBtn.classList.remove('hidden');
  }

  function updateScanStatus(text) {
    if (scanStatusText) scanStatusText.textContent = text;
    if (scanProgressFill) scanProgressFill.style.width = '0%';
  }

  // ─── Render Results ──────────────────────────
  function showResults(data, originalImage) {
    scanAnimation.classList.add('hidden');
    cameraSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    // Draw annotated image
    drawResultImage(originalImage, data.overlayData);

    // Render stats bar
    renderStats(data.uiConfig.stats);

    // Render product cards
    renderProductCards(data.products, data.uiConfig);

    // Render timing
    renderTiming(data.timing);
  }

  function handleBack() {
    resultsSection.classList.add('hidden');
    cameraSection.classList.remove('hidden');
    captureBtn.style.display = '';
    productCards.innerHTML = '';
    statsBar.innerHTML = '';
    timingInfo.innerHTML = '';

    // Reset accumulated results
    allResults = [];
    lastScanData = null;
    viewResultsBtn.classList.add('hidden');
    resultCount.textContent = '0';

    // Restart camera if it was stopped
    if (!stream) {
      startCamera().catch(() => {});
    }
  }

  // ─── Draw Annotated Image ─────────────────────
  function drawResultImage(imageDataUrl, overlayData) {
    const img = new Image();
    img.onload = () => {
      const canvas = resultCanvas;
      const ctx = canvas.getContext('2d');

      // Set canvas size to match image aspect ratio
      const maxWidth = Math.min(600, window.innerWidth - 32);
      const scale = maxWidth / img.width;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      // Draw original image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw overlays
      if (overlayData && overlayData.overlays) {
        overlayData.overlays.forEach(overlay => {
          drawOverlay(ctx, overlay, canvas.width, canvas.height);
        });
      }
    };
    img.src = imageDataUrl;
  }

  function drawOverlay(ctx, overlay, canvasW, canvasH) {
    const pos = overlay.position;
    const style = overlay.style;

    // Convert percentage coordinates to pixels
    const cx = pos.centerX * canvasW;
    const cy = pos.centerY * canvasH;
    // Base radius off canvas width (e.g., 2%)
    const r = Math.max(12, canvasW * pos.radius);

    // Draw filled circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = style.fillColor;
    ctx.fill();

    // Draw border
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.lineWidth;
    if (style.dashPattern && style.dashPattern.length > 0) {
      ctx.setLineDash(style.dashPattern);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw icon
    ctx.font = `bold ${Math.max(14, r * 0.8)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style.strokeColor;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(style.icon, cx, cy);
    ctx.shadowBlur = 0;

    // Draw label below/above
    const labelY = overlay.label.position === 'above' ? cy - r - 16 : cy + r + 16;
    ctx.font = `600 ${Math.max(10, r * 0.5)}px Inter, sans-serif`;
    ctx.fillStyle = style.strokeColor;

    // Label background
    const labelText = overlay.label.text;
    const metrics = ctx.measureText(labelText);
    const labelPadX = 6;
    const labelPadY = 3;
    const labelW = metrics.width + labelPadX * 2;
    const labelH = 16 + labelPadY * 2;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(cx - labelW / 2, labelY - labelH / 2, labelW, labelH, 4);
    ctx.fill();

    ctx.fillStyle = style.strokeColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, cx, labelY);
  }

  // ─── Render Stats Bar ─────────────────────────
  function renderStats(stats) {
    if (!stats) return;

    statsBar.innerHTML = `
      <div class="stat-pill">
        <span class="dot" style="background:var(--text-secondary)"></span>
        <span>${stats.total} Products</span>
      </div>
      <div class="stat-pill">
        <span class="dot" style="background:var(--green)"></span>
        <span>${stats.healthy} Healthy</span>
      </div>
      <div class="stat-pill">
        <span class="dot" style="background:var(--yellow)"></span>
        <span>${stats.moderate} Moderate</span>
      </div>
      <div class="stat-pill">
        <span class="dot" style="background:var(--red)"></span>
        <span>${stats.unhealthy} Unhealthy</span>
      </div>
    `;
  }

  // ─── Render Product Cards ─────────────────────
  function renderProductCards(products, uiConfig) {
    productCards.innerHTML = '';

    products.forEach((product, i) => {
      const health = product.health;
      const nutrition = product.nutrition || {};
      const card = document.createElement('div');
      card.className = 'product-card';
      card.style.animationDelay = `${i * 0.08}s`;

      const icon = getVerdictIcon(health.verdict);
      const v = product.verification || {};
      const verifiedBadge = v.status === 'verified'
        ? '<span class="verified-badge verified">✓ Verified</span>'
        : v.status === 'unverified'
          ? '<span class="verified-badge unverified">⚠ Unverified</span>'
          : '';

      const summary = health.summary || '';
      const impacts = getHealthImpacts(nutrition);
      const impactHTML = renderHealthImpacts(impacts);
      const verdictLabel = t(health.verdict) || health.label;

      card.innerHTML = `
        <div class="card-header">
          <div class="card-indicator ${health.verdict}">${icon}</div>
          <div class="card-title-area">
            <div class="card-name">${escapeHtml(product.name)}</div>
            <div class="card-brand">${escapeHtml(product.brand)} ${verifiedBadge}</div>
          </div>
          <div class="card-score ${health.verdict}">${verdictLabel}</div>
        </div>
        <div class="card-summary ${health.verdict}">${escapeHtml(summary)}</div>
        ${impactHTML ? `
          <div class="health-impact-toggle">${t('whatMeans')}</div>
          <div class="health-impact">
            <div class="health-impact-inner">${impactHTML}</div>
          </div>
        ` : ''}
        <div class="card-details-toggle">${t('showDetails')}</div>
        <div class="card-details" id="details-${product.id}">
          <div class="card-details-inner">
            ${renderNutritionGrid(nutrition)}
            ${renderReasons(health.reasons)}
            <div class="nutrition-source">
              ${t('source')}: ${escapeHtml(nutrition.source || 'N/A')}
            </div>
          </div>
        </div>
      `;

      // "What does this mean for me?" toggle
      const impactToggle = card.querySelector('.health-impact-toggle');
      if (impactToggle) {
        impactToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const impact = card.querySelector('.health-impact');
          const isExpanded = impact.classList.toggle('expanded');
          impactToggle.textContent = isExpanded ? t('hideImpact') : t('whatMeans');
        });
      }

      // Details toggle
      const toggle = card.querySelector('.card-details-toggle');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const details = card.querySelector('.card-details');
        const isExpanded = details.classList.toggle('expanded');
        toggle.textContent = isExpanded ? t('hideDetails') : t('showDetails');
      });

      productCards.appendChild(card);
    });
  }

  function getVerdictIcon(verdict) {
    switch (verdict) {
      case 'healthy': return '✓';
      case 'moderate': return '~';
      case 'unhealthy': return '✗';
      default: return '?';
    }
  }

  function renderNutritionGrid(nutrition) {
    const items = [];

    if (nutrition.sugar_100g != null) {
      items.push({ label: 'Sugar', value: `${nutrition.sugar_100g}g` });
    }
    if (nutrition.saturated_fat_100g != null) {
      items.push({ label: 'Sat. Fat', value: `${nutrition.saturated_fat_100g}g` });
    }
    if (nutrition.sodium_100g != null) {
      items.push({ label: 'Sodium', value: `${(nutrition.sodium_100g * 1000).toFixed(0)}mg` });
    }
    if (nutrition.nutri_score) {
      items.push({ label: 'Nutri-Score', value: nutrition.nutri_score.toUpperCase() });
    }
    if (nutrition.nova_group) {
      items.push({ label: 'NOVA', value: `${nutrition.nova_group}/4` });
    }
    if (nutrition.additives_count != null) {
      items.push({ label: 'Additives', value: `${nutrition.additives_count}` });
    }

    if (items.length === 0) return '<p class="reason-tag">No nutrition data available</p>';

    return `
      <div class="nutrition-grid">
        ${items.map(item => `
          <div class="nutrition-item">
            <div class="nutrition-label">${item.label}</div>
            <div class="nutrition-value">${item.value}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderReasons(reasons) {
    if (!reasons || reasons.length === 0) return '';

    return `
      <div class="reasons-list">
        ${reasons.map(r => `<div class="reason-tag">${escapeHtml(r)}</div>`).join('')}
      </div>
    `;
  }

  // ─── Render Timing ────────────────────────────
  function renderTiming(timing) {
    if (!timing) return;

    const stages = [
      { key: 'security', label: '🔒 Security' },
      { key: 'camera', label: '📸 Camera' },
      { key: 'vision', label: '🔍 Vision' },
      { key: 'nutrition', label: '🧠 Nutrition' },
      { key: 'health', label: '✅ Health' },
      { key: 'overlay', label: '🎯 Overlay' },
      { key: 'ui', label: '🎨 UI' },
    ];

    timingInfo.innerHTML = stages
      .filter(s => timing[s.key])
      .map(s => `
        <div class="timing-item">
          <span class="label">${s.label}:</span>
          <span class="value">${timing[s.key]}ms</span>
        </div>
      `)
      .join('') + `
        <div class="timing-item">
          <span class="label">⏱ Total:</span>
          <span class="value">${timing.total}ms</span>
        </div>
      `;
  }

  // ─── Download Results ────────────────────────
  function handleDownload() {
    if (!lastScanData) return;

    const data = lastScanData;
    const now = new Date();
    const timestamp = now.toLocaleString();
    const lines = [];

    lines.push('════════════════════════════════════════════');
    lines.push('  🛒 GROCERY SCANNER — HEALTH REPORT');
    lines.push('════════════════════════════════════════════');
    lines.push(`Date: ${timestamp}`);
    lines.push(`Products Scanned: ${data.products.length}`);
    lines.push('');

    // Summary stats
    if (data.uiConfig && data.uiConfig.stats) {
      const s = data.uiConfig.stats;
      lines.push('── Summary ─────────────────────────────────');
      lines.push(`  ✅ Healthy:   ${s.healthy}`);
      lines.push(`  ⚠️  Moderate:  ${s.moderate}`);
      lines.push(`  ❌ Unhealthy: ${s.unhealthy}`);
      lines.push('');
    }

    // Product details
    data.products.forEach((product, i) => {
      const h = product.health;
      const n = product.nutrition || {};

      lines.push(`── Product ${i + 1} ─────────────────────────────`);
      lines.push(`  Name:     ${product.name}`);
      lines.push(`  Brand:    ${product.brand}`);
      lines.push(`  Category: ${product.category}`);
      const vStatus = product.verification?.status === 'verified' ? '✓ Verified' : '⚠ Unverified';
      lines.push(`  Status:   ${vStatus}`);
      lines.push(`  Verdict:  ${h.label}`);
      if (h.summary) lines.push(`  ➜ ${h.summary}`);
      lines.push('');

      // Nutrition values
      lines.push('  Nutrition (per 100g):');
      if (n.sugar_100g != null) lines.push(`    Sugar:         ${n.sugar_100g}g`);
      if (n.saturated_fat_100g != null) lines.push(`    Saturated Fat: ${n.saturated_fat_100g}g`);
      if (n.sodium_100g != null) lines.push(`    Sodium:        ${(n.sodium_100g * 1000).toFixed(0)}mg`);
      if (n.fiber_100g != null) lines.push(`    Fiber:         ${n.fiber_100g}g`);
      if (n.nutri_score) lines.push(`    Nutri-Score:   ${n.nutri_score.toUpperCase()}`);
      if (n.nova_group) lines.push(`    NOVA Group:    ${n.nova_group}/4`);
      if (n.additives_count != null) lines.push(`    Additives:     ${n.additives_count}`);
      lines.push(`    Data Source:   ${n.source || 'N/A'}`);
      lines.push(`    Data Quality:  ${n.data_quality || 'N/A'}`);
      lines.push('');

      // Health reasons
      if (h.reasons && h.reasons.length > 0) {
        lines.push('  Health Flags:');
        h.reasons.forEach(r => lines.push(`    • ${r}`));
        lines.push('');
      }
    });

    // Timing
    if (data.timing) {
      lines.push('── Processing Time ─────────────────────────');
      const stages = ['security', 'camera', 'vision', 'nutrition', 'health', 'overlay', 'ui'];
      stages.forEach(s => {
        if (data.timing[s]) lines.push(`  ${s.charAt(0).toUpperCase() + s.slice(1)}: ${data.timing[s]}ms`);
      });
      lines.push(`  Total: ${data.timing.total}ms`);
    }

    lines.push('');
    lines.push('════════════════════════════════════════════');
    lines.push('  Generated by GroceryScan');
    lines.push('════════════════════════════════════════════');

    // Trigger download
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grocery-scan-${now.toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Utilities ────────────────────────────────
  function showError(message) {
    errorText.textContent = message;
    errorToast.classList.remove('hidden');
    setTimeout(() => errorToast.classList.add('hidden'), 8000);
  }

  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Start ────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
