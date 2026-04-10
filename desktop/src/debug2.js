// Test desde src/ (sin node_modules propio) para forzar el builtin electron
'use strict';
try {
  const e = require('electron');
  console.log('TYPE:', typeof e);
  if (typeof e === 'object') {
    console.log('KEYS:', Object.keys(e).slice(0, 20));
    console.log('app?', typeof e.app);
  } else {
    console.log('VALUE (string/path):', String(e).slice(0, 80));
  }
} catch(err) {
  console.log('ERROR:', err.message);
}
process.exit(0);
