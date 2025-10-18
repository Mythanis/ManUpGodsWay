import { db } from './server/db';
import { logoSettings, headerLogoSettings } from './shared/schema';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';

async function updateLogos() {
  try {
    // Read the base64 data URL from file
    const logoDataUrl = fs.readFileSync('logo-data-url.txt', 'utf-8').trim();
    
    console.log('Logo data URL length:', logoDataUrl.length);
    console.log('Updating logos in database...');
    
    // Update splash screen logo
    const splashResult = await db.update(logoSettings)
      .set({ 
        logoUrl: logoDataUrl,
        backgroundColor: 'black',
        updatedAt: new Date()
      })
      .returning();
    
    console.log('Splash screen logo updated:', splashResult.length > 0 ? 'Success' : 'No rows updated');
    
    // Update header logo
    const headerResult = await db.update(headerLogoSettings)
      .set({ 
        logoUrl: logoDataUrl,
        updatedAt: new Date()
      })
      .returning();
    
    console.log('Header logo updated:', headerResult.length > 0 ? 'Success' : 'No rows updated');
    
    console.log('\nBoth logos have been updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating logos:', error);
    process.exit(1);
  }
}

updateLogos();
