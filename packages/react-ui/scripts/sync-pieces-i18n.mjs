#!/usr/bin/env node

/**
 * Sync i18n files from packages/pieces/community to react-ui/public/locales/pieces
 * This keeps react-ui pieces translations in sync with the source of truth
 * 
 * UPDATE: We are now using react-ui/public/locales as the single source of truth.
 * Syncing from pieces is disabled to prevent overwrites.
 * This script now only regenerates the manifest.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../../..');
const REACT_UI_LOCALES_DIR = path.join(ROOT_DIR, 'packages/react-ui/public/locales');

// Locales to check
const LOCALES = ['en', 'zh', 'cn'];

async function syncPiecesI18n() {
  console.log('Syncing from community pieces is DISABLED. Using react-ui/public/locales as source of truth.\n');
  console.log(`Source Directory: ${REACT_UI_LOCALES_DIR}`);

  // iterate over locales and ensure they exist
  let valid = true;
  for (const locale of LOCALES) {
      const localePath = path.join(REACT_UI_LOCALES_DIR, locale);
      const translationFile = path.join(localePath, 'translation.json');
      const piecesDir = path.join(localePath, 'pieces');

      if (!fs.existsSync(translationFile)) {
          console.warn(`⚠ Warning: translation.json not found for ${locale} at ${translationFile}`);
          valid = false;
      }
      if (!fs.existsSync(piecesDir)) {
          console.warn(`⚠ Warning: pieces directory not found for ${locale} at ${piecesDir}`);
          valid = false;
      }
  }

  if (valid) {
      console.log('✓ Verified existence of translation.json and pieces directories for all locales.');
  }
  
  // Regenerate manifest files
  console.log('\nRegenerating manifest files...');
  const { execSync } = await import('child_process');
  try {
    execSync('node scripts/generate-pieces-manifest.mjs', {
      cwd: path.join(ROOT_DIR, 'packages/react-ui'),
      stdio: 'inherit',
    });
    console.log('✓ Manifest files regenerated');
  } catch (error) {
    console.error('✗ Failed to regenerate manifest files:', error.message);
  }
}

syncPiecesI18n().catch(console.error);
