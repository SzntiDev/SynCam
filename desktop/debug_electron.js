// Debug script — saber qué exporta require('electron') en este entorno
'use strict';
const e = require('electron');
console.log('TYPE:', typeof e);
console.log('KEYS:', Object.keys(e || {}));
console.log('app defined?', typeof e.app);
console.log('default?', typeof e.default);
if (e.default) console.log('default keys:', Object.keys(e.default));
process.exit(0);
