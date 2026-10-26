// Generate a pixel-art Server Rack (64x96) in pure Node.js Canvas or PNG
const fs = require('fs');
const path = require('path');

// We use pngjs if installed or write raw uncompressed PNG chunk
// Let's check if pngjs or canvas exists in node_modules
const hasPngjs = fs.existsSync(path.resolve(__dirname, 'node_modules/pngjs'));
console.log('pngjs exists:', hasPngjs);
