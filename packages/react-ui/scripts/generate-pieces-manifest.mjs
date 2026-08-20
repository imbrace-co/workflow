import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, '../public/locales');
const locales = ['cn', 'zh', 'en'];

locales.forEach((locale) => {
  const piecesDir = path.join(localesDir, locale, 'pieces');
  
  if (!fs.existsSync(piecesDir)) {
    console.log(`Pieces directory does not exist for locale: ${locale}`);
    return;
  }

  const files = fs.readdirSync(piecesDir)
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''))
    .sort();

  const manifestPath = path.join(piecesDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2));
  console.log(`Generated manifest for ${locale}: ${files.length} pieces`);
});
