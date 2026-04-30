const { Jimp } = require('jimp');
const fs = require('fs');

async function removeBackground() {
  const imagePath = 'public/assistant-walle.png';
  if (!fs.existsSync(imagePath)) {
    console.error('Image not found:', imagePath);
    return;
  }

  const image = await Jimp.read(imagePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  // We'll just turn ALL near-white pixels outside the robot into transparent.
  // We'll also remove the black border entirely.

  // 1. Remove black border (set outer 25 pixels to transparent)
  const borderSize = 25;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < borderSize || x >= width - borderSize || y < borderSize || y >= height - borderSize) {
        const idx = (y * width + x) * 4;
        image.bitmap.data[idx + 3] = 0; // alpha
      }
    }
  }

  // 2. Flood fill from point (borderSize + 5, borderSize + 5) which should be the white background
  const isWhiteBg = (color) => {
    // If it's bright enough, it's the background.
    return color.r > 230 && color.g > 230 && color.b > 230;
  };

  const visited = Array(height).fill(0).map(() => Array(width).fill(false));
  const queue = [{x: borderSize + 5, y: borderSize + 5}];
  
  let processed = 0;
  while (queue.length > 0) {
    const {x, y} = queue.shift();
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[y][x]) continue;
    
    const idx = (y * width + x) * 4;
    const color = {
      r: image.bitmap.data[idx],
      g: image.bitmap.data[idx + 1],
      b: image.bitmap.data[idx + 2]
    };

    if (isWhiteBg(color) || image.bitmap.data[idx + 3] === 0) {
      visited[y][x] = true;
      if (image.bitmap.data[idx + 3] !== 0) {
        image.bitmap.data[idx + 3] = 0; // Make transparent
        processed++;
      }
      
      // Add neighbors
      queue.push({x: x + 1, y});
      queue.push({x: x - 1, y});
      queue.push({x, y: y + 1});
      queue.push({x, y: y - 1});
    }
  }

  // 3. Optional pass: any near-white pixel that is touching a transparent pixel becomes transparent too, to remove halos
  let halosRemoved = 0;
  for(let i=0; i<3; i++) { // 3 passes
    const toClear = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (image.bitmap.data[idx + 3] > 0) {
          const r = image.bitmap.data[idx];
          const g = image.bitmap.data[idx + 1];
          const b = image.bitmap.data[idx + 2];
          
          if (r > 200 && g > 200 && b > 200) {
            // Check neighbors
            let hasTransparentNeighbor = false;
            if (image.bitmap.data[((y)*width+(x+1))*4 + 3] === 0) hasTransparentNeighbor = true;
            if (image.bitmap.data[((y)*width+(x-1))*4 + 3] === 0) hasTransparentNeighbor = true;
            if (image.bitmap.data[((y+1)*width+(x))*4 + 3] === 0) hasTransparentNeighbor = true;
            if (image.bitmap.data[((y-1)*width+(x))*4 + 3] === 0) hasTransparentNeighbor = true;
            
            if (hasTransparentNeighbor) {
              toClear.push(idx);
            }
          }
        }
      }
    }
    for(const idx of toClear) {
      image.bitmap.data[idx + 3] = 0;
      halosRemoved++;
    }
  }

  console.log(`Made ${processed} bg pixels transparent. Removed ${halosRemoved} halo pixels.`);
  
  await image.write('public/assistant-walle.png');
  console.log('Background removed successfully.');
}

removeBackground().catch(console.error);
