const fs = require('fs');

const filesToFix = [
  "src/routes/_app.appointments.tsx",
  "src/routes/_app.orders.index.tsx",
  "src/routes/_app.products.index.tsx",
  "src/routes/_app.projects.$id.tsx",
  "src/routes/_app.projects.index.tsx",
  "src/routes/_app.quotes.$id.tsx",
  "src/routes/_app.stock.tsx"
];

filesToFix.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  let changed = false;

  const newC = c.replace(/onChange=\{e = step="any">/g, 'step="any" onChange={e =>')
                .replace(/onChange=\{\(e\) = step="any">/g, 'step="any" onChange={(e) =>');

  if (c !== newC) {
    fs.writeFileSync(file, newC);
    console.log("Fixed", file);
  }
});
