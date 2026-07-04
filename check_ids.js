const fs = require('fs');
const js = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const jsIds = new Set();
while ((match = idRegex.exec(js)) !== null) {
  jsIds.add(match[1]);
}

let missingIds = [];
for (const id of jsIds) {
  if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
    missingIds.push(id);
  }
}

console.log('Missing IDs in HTML:', missingIds);
