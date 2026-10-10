// Re-creates src/logoData.js from assets/logo.png
import { readFileSync, writeFileSync } from 'node:fs';
const b64 = readFileSync(new URL('../assets/logo.png', import.meta.url)).toString('base64');
writeFileSync(new URL('../src/logoData.js', import.meta.url),
  "// Kokobi+ logo embedded as base64 so receipts work on hosts that only deploy code files (e.g. Vercel).\n// To change the logo, replace assets/logo.png and run:  npm run build:logo --prefix server\nexport const LOGO_BASE64 =\n  '" + b64 + "';\n");
console.log('Wrote src/logoData.js');
