const fs = require('fs');
const { PNG } = require('pngjs');

// Helper script to find the exact Y coordinates of horizontal bars
const imgPath = 'C:\\Users\\piant\\OneDrive - unibs.it\\Desktop\\Programmi\\ac-chiari\\public\\scaffale-bg.png';

if (!fs.existsSync(imgPath)) {
  console.log("Image not found");
  process.exit(1);
}

fs.createReadStream(imgPath)
  .pipe(new PNG())
  .on('parsed', function() {
    const width = this.width;
    const height = this.height;
    console.log(`Image size: ${width}x${height}`);
    
    // Scan a vertical column in the middle of Bay 2 (x = width * 0.5)
    const x = Math.floor(width * 0.5);
    
    // We are looking for grey pixels (horizontal bars) in an otherwise white/beige background.
    // Let's print the brightness of pixels in this column to find the bars.
    let bars = [];
    let inBar = false;
    let barStart = 0;
    
    for (let y = 0; y < height; y++) {
      let idx = (width * y + x) << 2;
      let r = this.data[idx];
      let g = this.data[idx+1];
      let b = this.data[idx+2];
      
      // Calculate brightness
      let brightness = (r + g + b) / 3;
      
      // The background is light (~240-250), bars are dark grey (~150-180 or with black outlines)
      let isDark = brightness < 220;
      
      if (isDark && !inBar) {
        inBar = true;
        barStart = y;
      } else if (!isDark && inBar) {
        inBar = false;
        bars.push({start: barStart, end: y - 1});
      }
    }
    
    // If the image ends while in a bar
    if (inBar) {
        bars.push({start: barStart, end: height - 1});
    }

    console.log("Detected horizontal bars (Y coords):");
    bars.forEach((b, i) => {
      let startPct = (b.start / height * 100).toFixed(2);
      let endPct = (b.end / height * 100).toFixed(2);
      let thickness = ((b.end - b.start) / height * 100).toFixed(2);
      console.log(`Bar ${i+1}: Y ${b.start} to ${b.end} (${startPct}% to ${endPct}%), thickness: ${thickness}%`);
    });
    
    // Scan horizontal at y = height / 2 to find uprights
    const yMid = Math.floor(height / 2);
    let uprights = [];
    let inUpright = false;
    let uprightStart = 0;
    
    for (let currentX = 0; currentX < width; currentX++) {
      let idx = (width * yMid + currentX) << 2;
      let r = this.data[idx];
      let g = this.data[idx+1];
      let b = this.data[idx+2];
      
      let brightness = (r + g + b) / 3;
      let isDark = brightness < 220; // Uprights are also dark grey
      
      if (isDark && !inUpright) {
        inUpright = true;
        uprightStart = currentX;
      } else if (!isDark && inUpright) {
        inUpright = false;
        // Ignore very thin artifacts
        if (currentX - uprightStart > 5) {
            uprights.push({start: uprightStart, end: currentX - 1});
        }
      }
    }
    
    if (inUpright) {
        uprights.push({start: uprightStart, end: width - 1});
    }
    
    console.log("\nDetected vertical uprights (X coords):");
    uprights.forEach((u, i) => {
      let startPct = (u.start / width * 100).toFixed(2);
      let endPct = (u.end / width * 100).toFixed(2);
      console.log(`Upright ${i+1}: X ${u.start} to ${u.end} (${startPct}% to ${endPct}%)`);
    });

  });
