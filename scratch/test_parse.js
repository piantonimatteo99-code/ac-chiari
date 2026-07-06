const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

// Find the line starting with FIREBASE_SERVICE_ACCOUNT_KEY
const line = envContent.split('\n').find(l => l.trim().startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
if (!line) {
  console.error("Could not find key in .env.local");
  process.exit(1);
}

// Extract the value
let value = line.split('=')[1].trim();
if (value.startsWith("'") && value.endsWith("'")) {
  value = value.substring(1, value.length - 1);
} else if (value.startsWith('"') && value.endsWith('"')) {
  value = value.substring(1, value.length - 1);
}

console.log("Raw string length:", value.length);
console.log("Substr around position 170:", value.substring(150, 200));

// Let's try to parse it by cleaning it
try {
  // If there are single backslashes followed by letters that are not valid escapes, let's fix them.
  // Actually, since Next.js parses it, let's see how Next.js does it.
  // Let's replace any single backslash that is not escaping a valid character, or let's double check.
  const serviceAccount = JSON.parse(value);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  console.log("Parsed successfully!");
} catch (e) {
  console.error("Standard JSON parse failed:", e.message);
  
  // Let's try to fix double escaping:
  try {
    // If it was double-escaped, let's see if we replace \\ with \ or similar.
    // Wait, let's try replacing \\n with \n and then parsing, or replacing all \\ with \
    // Wait, let's look at the character at position 170:
    console.log("Char at 170:", value[170]);
    console.log("Char at 171:", value[171]);
    console.log("Char at 172:", value[172]);
    console.log("Chars around 170:", value.substring(165, 175));
  } catch (err) {
    console.error(err);
  }
}
