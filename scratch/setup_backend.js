import fs from 'fs';
import path from 'path';

const root = process.cwd();
const backendDir = path.join(root, 'backend');

// 1. Copy database directory
const dbSrc = path.join(root, 'database');
const dbDest = path.join(backendDir, 'database');
if (!fs.existsSync(dbDest)) fs.mkdirSync(dbDest, { recursive: true });

for (const file of fs.readdirSync(dbSrc)) {
  fs.copyFileSync(path.join(dbSrc, file), path.join(dbDest, file));
  console.log(`Copied database file: ${file}`);
}

// 2. Copy tests directory
const testsSrc = path.join(root, 'tests');
const testsDest = path.join(backendDir, 'tests');
if (!fs.existsSync(testsDest)) fs.mkdirSync(testsDest, { recursive: true });

for (const file of fs.readdirSync(testsSrc)) {
  fs.copyFileSync(path.join(testsSrc, file), path.join(testsDest, file));
  console.log(`Copied tests file: ${file}`);
}

// 3. Copy scratch directory
const scratchSrc = path.join(root, 'scratch');
const scratchDest = path.join(backendDir, 'scratch');
if (!fs.existsSync(scratchDest)) fs.mkdirSync(scratchDest, { recursive: true });

for (const file of fs.readdirSync(scratchSrc)) {
  if (fs.statSync(path.join(scratchSrc, file)).isFile()) {
    fs.copyFileSync(path.join(scratchSrc, file), path.join(scratchDest, file));
    console.log(`Copied scratch file: ${file}`);
  }
}

// 4. Copy images directory
const imagesSrc = path.join(root, 'public', 'images');
const imagesDest = path.join(backendDir, 'images');
if (!fs.existsSync(imagesDest)) fs.mkdirSync(imagesDest, { recursive: true });
const reviewsDest = path.join(imagesDest, 'reviews');
if (!fs.existsSync(reviewsDest)) fs.mkdirSync(reviewsDest, { recursive: true });

for (const file of fs.readdirSync(imagesSrc)) {
  const p = path.join(imagesSrc, file);
  if (fs.statSync(p).isFile()) {
    fs.copyFileSync(p, path.join(imagesDest, file));
  }
}
console.log(`Copied images to backend/images`);

// 5. Copy .env and .env.example
if (fs.existsSync(path.join(root, '.env'))) {
  fs.copyFileSync(path.join(root, '.env'), path.join(backendDir, '.env'));
  console.log('Copied .env to backend/.env');
}
if (fs.existsSync(path.join(root, '.env.example'))) {
  fs.copyFileSync(path.join(root, '.env.example'), path.join(backendDir, '.env.example'));
  console.log('Copied .env.example to backend/.env.example');
}

// 6. Copy server.js
if (fs.existsSync(path.join(root, 'server.js'))) {
  fs.copyFileSync(path.join(root, 'server.js'), path.join(backendDir, 'server.js'));
  console.log('Copied server.js to backend/server.js');
}

console.log('Backend setup files copied successfully!');
