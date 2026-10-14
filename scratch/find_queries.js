import fs from 'fs';
import path from 'path';

const routesDir = path.resolve('backend/routes');
const files = fs.readdirSync(routesDir);

for (const file of files) {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const matches = [...content.matchAll(/db\.(all|get|run|exec)\(\s*([`"'][\s\S]*?[`"'])/g)];
  console.log(`=== ${file} (${matches.length} queries) ===`);
  for (const m of matches) {
    const q = m[2].replace(/\s+/g, ' ').trim().slice(0, 90);
    console.log(`  ${m[1]}: ${q}`);
  }
}
