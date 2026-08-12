const fs = require('fs');
const path = require('path');

const LANG_FILE = path.join(__dirname, '..', 'src/context/language-context.tsx');
let content = fs.readFileSync(LANG_FILE, 'utf-8');

const arMatch = content.match(/ar:\s*{([\s\S]*?)\n\s*},\s*\n\s*en:/);
const enMatch = content.match(/en:\s*{([\s\S]*?)\n\s*}\n};/);

if(!arMatch || !enMatch) {
  console.log('❌ Could not parse the file correctly.');
  process.exit(1);
}

const arPairs = [...arMatch[1].matchAll(/^\s*'([^']+)'\s*:\s*'([^']*)'/gm)];
const enKeys = new Set([...enMatch[1].matchAll(/^\s*'([^']+)'\s*:/gm)].map(m => m[1]));

let missing = [];
for(const [, key, val] of arPairs) {
  if(!enKeys.has(key)) {
    missing.push(`    '${key}': '${val}',`);
  }
}

if(missing.length === 0) {
  console.log('✅ No missing keys! EN is in sync with AR.');
  process.exit(0);
}

const insertText = missing.join('\n') + '\n';
const newEnBlock = enMatch[0].replace(/\n\s*}\n};/, '\n' + insertText + '  }\n};');

content = content.replace(enMatch[0], newEnBlock);
fs.writeFileSync(LANG_FILE, content);

console.log(`✅ Fixed! Added ${missing.length} missing keys to the EN section.`);