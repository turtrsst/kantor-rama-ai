const fs = require('fs');
const sizeOf = (buffer) => {
  // basic jpeg dimension reader
  let i = 0;
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;
  i += 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xFF) return null;
    const marker = buffer[i + 1];
    if (marker === 0xC0 || marker === 0xC2) {
      return {
        height: buffer.readUInt16BE(i + 5),
        width: buffer.readUInt16BE(i + 7)
      };
    }
    const len = buffer.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
};
const buf = fs.readFileSync('C:/Users/hp/Downloads/image_b8a1d35.jpg');
console.log('image_b8a1d35 dimensions:', sizeOf(buf));
