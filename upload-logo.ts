import fs from 'fs';
import path from 'path';

// Read the logo file and convert to base64 data URL
const logoPath = path.join(process.cwd(), 'attached_assets/Man Up Logo-Gods way-White-Yellow copy_1760793820781.png');
const logoBuffer = fs.readFileSync(logoPath);
const base64Logo = `data:image/png;base64,${logoBuffer.toString('base64')}`;

console.log('Base64 Data URL length:', base64Logo.length);
console.log('First 100 characters:', base64Logo.substring(0, 100));
console.log('\nTo upload this logo:');
console.log('1. Copy the data URL above');
console.log('2. Use it to update the database directly');
console.log('\nOr run the SQL to update:');
console.log(`
-- Update splash screen logo
UPDATE logo_settings 
SET logo_url = '${base64Logo.substring(0, 50)}...' -- (truncated for display)
WHERE id = (SELECT id FROM logo_settings LIMIT 1);

-- Update header logo  
UPDATE header_logo_settings
SET logo_url = '${base64Logo.substring(0, 50)}...' -- (truncated for display)
WHERE id = (SELECT id FROM header_logo_settings LIMIT 1);
`);

// Write to a file for easy access
fs.writeFileSync('logo-data-url.txt', base64Logo);
console.log('\nBase64 data URL written to: logo-data-url.txt');
