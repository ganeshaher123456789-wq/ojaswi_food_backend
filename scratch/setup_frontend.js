import fs from 'fs';
import path from 'path';

const root = process.cwd();
const frontendDir = path.join(root, 'frontend');

const dirsToCreate = [
  frontendDir,
  path.join(frontendDir, 'public'),
  path.join(frontendDir, 'public', 'images'),
  path.join(frontendDir, 'src'),
  path.join(frontendDir, 'src', 'js'),
  path.join(frontendDir, 'src', 'css'),
  path.join(frontendDir, 'js'),
  path.join(frontendDir, 'css'),
  path.join(frontendDir, 'images'),
  path.join(frontendDir, 'legacy')
];

for (const dir of dirsToCreate) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 1. Copy HTML files
const htmlFiles = [
  'index.html',
  'login.html',
  'account.html',
  'orders.html',
  'checkout.html',
  'order-confirmation.html',
  'admin.html',
  'contact-us.html',
  'privacy-policy.html',
  'terms-and-conditions.html',
  'refund-policy.html',
  'shipping-policy.html',
  'cancellation-policy.html'
];

for (const file of htmlFiles) {
  const src = fs.existsSync(path.join(root, 'public', file))
    ? path.join(root, 'public', file)
    : path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(frontendDir, file));
    fs.copyFileSync(src, path.join(frontendDir, 'public', file));
    console.log(`Copied HTML: ${file}`);
  }
}

// Legacy HTML
for (const file of ['index2.html', 'index3.html']) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(frontendDir, file));
    fs.copyFileSync(src, path.join(frontendDir, 'legacy', file));
    console.log(`Copied Legacy HTML: ${file}`);
  }
}

// Legacy script
if (fs.existsSync(path.join(root, 'javascript.js'))) {
  fs.copyFileSync(path.join(root, 'javascript.js'), path.join(frontendDir, 'legacy', 'javascript.js'));
  fs.copyFileSync(path.join(root, 'javascript.js'), path.join(frontendDir, 'js', 'javascript.js'));
}

// 2. Copy robots.txt & sitemap.xml
for (const file of ['robots.txt', 'sitemap.xml']) {
  const src = path.join(root, 'public', file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(frontendDir, file));
    fs.copyFileSync(src, path.join(frontendDir, 'public', file));
    console.log(`Copied: ${file}`);
  }
}

// 3. Copy CSS files
const cssFiles = ['main.css', 'ecom.css'];
for (const file of cssFiles) {
  const src = path.join(root, 'public', 'css', file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(frontendDir, 'css', file));
    fs.copyFileSync(src, path.join(frontendDir, 'src', 'css', file));
    console.log(`Copied CSS: ${file}`);
  }
}

// 4. Copy JS files
const jsFiles = ['ojaswi.js', 'api.js', 'cart.js', 'main.js'];
for (const file of jsFiles) {
  // Prefer the version with mobileAuthContainer if main.js
  let src = path.join(root, 'public', 'js', file);
  if (file === 'main.js' && fs.existsSync(path.join(root, 'js', 'main.js'))) {
    src = path.join(root, 'js', 'main.js');
  }
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(frontendDir, 'js', file));
    fs.copyFileSync(src, path.join(frontendDir, 'src', 'js', file));
    console.log(`Copied JS: ${file}`);
  }
}

// 5. Copy Images
const imageSourceDir = path.join(root, 'public', 'images');
const images = fs.readdirSync(imageSourceDir);
for (const img of images) {
  const src = path.join(imageSourceDir, img);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, path.join(frontendDir, 'images', img));
    fs.copyFileSync(src, path.join(frontendDir, 'public', 'images', img));
  }
}
console.log(`Copied ${images.length} images to frontend/images and frontend/public/images.`);

console.log('Frontend setup completed successfully!');
