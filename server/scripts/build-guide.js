// Re-creates src/guideData.js from assets/Kokobi-Usage-Guide.pdf
// To change the guide: edit scripts/build-guide.py, run `python3 scripts/build-guide.py`, then `npm run build:guide`.
import { readFileSync, writeFileSync } from 'node:fs';
const b64 = readFileSync(new URL('../assets/Kokobi-Usage-Guide.pdf', import.meta.url)).toString('base64');
writeFileSync(new URL('../src/guideData.js', import.meta.url),
  "// The customer usage guide PDF, embedded as base64 so it works on hosts that only deploy code files (e.g. Vercel).\n// Rebuild with:  npm run build:guide --prefix server\nexport const GUIDE_BASE64 =\n  '" + b64 + "';\n");
console.log('Wrote src/guideData.js');
