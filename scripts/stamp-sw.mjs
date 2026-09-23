import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.join(__dirname, '..', 'public', 'sw.js');
const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || Date.now().toString();

const contents = fs.readFileSync(swPath, 'utf8');
const stamped = contents.replace(
  /const CACHE_NAME = '.*?';/,
  `const CACHE_NAME = 'palabras-${version}';`
);

fs.writeFileSync(swPath, stamped);
console.log(`Stamped sw.js with CACHE_NAME=palabras-${version}`);
