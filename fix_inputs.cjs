const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('type="number"')) {
        results.push(file);
      }
    }
  });
  return results;
}

const res = walk('./src');
res.forEach(r => {
  let c = fs.readFileSync(r, 'utf8');
  let changed = false;
  
  // Replace <Input type="number" ... > missing a step, or adjust it
  // We'll just do a global check: if it's a number input and doesn't have step, let's add step="any"
  // Actually, wait, it's safer to only add step="any" to things like quantity, price, discount etc.
  // We can just add step="any" to ALL type="number" to avoid HTML5 validation errors on decimals.
  // Because the CSS takes care of the spin button hover, and "any" allows decimals.
  // Wait, the user said "for quantity keep the decimal possible but always an incrementation by one".
  // If we set step="any", the up/down arrows increment by 1 by default! 
  
  // Let's find type="number" without step="any" and replace it
  const regex = /(<Input[^>]*type="number"[^>]*)>/g;
  let newC = c.replace(regex, (match, p1) => {
    if (!p1.includes('step=')) {
      return p1 + ' step="any">';
    }
    return match;
  });

  const regex2 = /(<input[^>]*type="number"[^>]*)>/g;
  newC = newC.replace(regex2, (match, p1) => {
    if (!p1.includes('step=')) {
      return p1 + ' step="any">';
    }
    return match;
  });
  
  if (c !== newC) {
    fs.writeFileSync(r, newC);
    console.log(r);
  }
});
