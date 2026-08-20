import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

import { LocalesEnum } from '@activepieces/shared';

// Function to load and merge pieces translations
async function loadPiecesTranslations(lng: string) {
  try {
    console.log(`[i18n] Loading pieces translations for locale: ${lng}`);
    
    // Load the manifest file that lists all pieces
    const manifestUrl = `/locales/${lng}/pieces/manifest.json`;
    const manifestResponse = await fetch(manifestUrl).catch((err) => {
      console.warn(`[i18n] Failed to fetch manifest from ${manifestUrl}:`, err);
      return null;
    });
    
    if (!manifestResponse || !manifestResponse.ok) {
      console.warn(`[i18n] Manifest not found or invalid for ${lng} (status: ${manifestResponse?.status})`);
      return;
    }
    
    const piecesList: string[] = await manifestResponse.json();
    console.log(`[i18n] Found ${piecesList.length} pieces in manifest`);
    
    const piecesTranslations: Record<string, string> = {};
    
    // Load all pieces files in parallel and merge them
    const loadPromises = piecesList.map(async (pieceName) => {
      try {
        const pieceUrl = `/locales/${lng}/pieces/${pieceName}.json`;
        const response = await fetch(pieceUrl);
        if (response.ok) {
          const translations = await response.json();
          return translations;
        } else {
          console.warn(`[i18n] Failed to load ${pieceUrl} (status: ${response.status})`);
        }
      } catch (e) {
        console.warn(`[i18n] Error loading piece ${pieceName}:`, e);
      }
      return null;
    });
    
    const loadedTranslations = await Promise.all(loadPromises);
    
    // Merge all pieces translations into a single object
    let loadedCount = 0;
    loadedTranslations.forEach((translations) => {
      if (translations && typeof translations === 'object') {
        Object.assign(piecesTranslations, translations);
        loadedCount++;
      }
    });
    
    console.log(`[i18n] Loaded ${loadedCount} pieces, total keys: ${Object.keys(piecesTranslations).length}`);
    
    // Merge pieces translations into the default namespace
    if (Object.keys(piecesTranslations).length > 0) {
      i18n.addResourceBundle(lng, 'translation', piecesTranslations, true, true);
      console.log(`[i18n] Successfully merged pieces translations for ${lng}`);
      
      // Test a few keys to verify
      const testKeys = Object.keys(piecesTranslations).slice(0, 3);
      testKeys.forEach(key => {
        const translated = i18n.t(key, { lng });
        console.log(`[i18n] Test key "${key}": "${translated}"`);
      });
    } else {
      console.warn(`[i18n] No pieces translations loaded for ${lng}`);
    }
  } catch (e) {
    console.error(`[i18n] Failed to load pieces translations for ${lng}:`, e);
  }
}

// Register event handlers BEFORE init
// Load pieces translations after i18n is initialized and backend has loaded
i18n.on('initialized', async () => {
  const currentLng = i18n.language || 'en';
  console.log(`[i18n] Initialized event fired, language: ${currentLng}`);
  // Wait a bit to ensure backend has finished loading translation.json
  await new Promise(resolve => setTimeout(resolve, 100));
  await loadPiecesTranslations(currentLng);
});

// Load pieces translations when language changes
i18n.on('languageChanged', async (lng) => {
  console.log(`[i18n] Language changed to: ${lng}`);
  // Wait a bit to ensure backend has finished loading translation.json
  await new Promise(resolve => setTimeout(resolve, 100));
  await loadPiecesTranslations(lng);
});

i18n
  .use(ICU)
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    supportedLngs: Object.values(LocalesEnum),
    keySeparator: false,
    nsSeparator: false,
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lang',
      caches: ['localStorage', 'cookie'],
    },
    returnEmptyString: false,
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

export default i18n;
