import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('public').filter(f => f.endsWith('.html'));
for (const file of files) {
  const content = fs.readFileSync(path.join('public', file), 'utf8');
  const scripts = [...content.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  const links = [...content.matchAll(/<link[^>]*href=["']([^"']+\.css[^"']*)["'][^>]*>/gi)].map(m => m[1]);
  console.log(file, '-> scripts:', scripts, 'css:', links);
}
