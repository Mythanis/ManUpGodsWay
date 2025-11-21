import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, or, isNull } from "drizzle-orm";

// In-memory cache for geocoded locations
const geocodeCache = new Map<string, { lat: number; lng: number }>();

// Service to automatically geocode war groups missing coordinates
class WarGroupsGeocodingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isProcessing = false;

  // Check every 2 hours for groups needing geocoding
  private readonly CHECK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  start() {
    if (this.isRunning) {
      console.log('War Groups geocoding service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting War Groups geocoding service...');
    
    // Run initial geocoding after a short delay to allow server to fully start
    setTimeout(() => {
      this.geocodeAllGroups();
    }, 5000); // 5 second delay
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.geocodeAllGroups();
    }, this.CHECK_INTERVAL);

    console.log(`War Groups geocoding service started - checking every ${this.CHECK_INTERVAL / 1000 / 60 / 60} hours`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.isProcessing = false;
    console.log('War Groups geocoding service stopped');
  }

  private async geocodeLocation(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
    const cacheKey = `${city.toLowerCase()},${state.toLowerCase()}`;
    
    // Check cache first
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey)!;
    }
    
    try {
      // Use OpenStreetMap Nominatim API (free, no API key required)
      const query = encodeURIComponent(`${city}, ${state}, USA`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
        {
          headers: {
            'User-Agent': 'ManUpGodsWay/1.0'
          }
        }
      );
      
      if (!response.ok) {
        console.error(`Geocoding failed for ${city}, ${state}`);
        return null;
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        
        // Cache the result
        geocodeCache.set(cacheKey, coords);
        
        // Add a delay to respect Nominatim's usage policy (max 1 req/sec)
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        return coords;
      }
      
      return null;
    } catch (error) {
      console.error(`Error geocoding ${city}, ${state}:`, error);
      return null;
    }
  }

  private async geocodeAllGroups() {
    if (this.isProcessing) {
      console.log('Geocoding already in progress, skipping this run');
      return;
    }

    this.isProcessing = true;

    try {
      console.log('Checking for war groups that need geocoding...');
      
      // Get all active, licensed groups without coordinates
      const groupsNeedingGeocode = await db.select()
        .from(schema.warGroups)
        .where(
          or(
            isNull(schema.warGroups.latitude),
            isNull(schema.warGroups.longitude)
          )
        );
      
      if (groupsNeedingGeocode.length === 0) {
        console.log('All war groups have coordinates - no geocoding needed');
        this.isProcessing = false;
        return;
      }

      console.log(`Found ${groupsNeedingGeocode.length} war groups needing geocoding`);

      let successCount = 0;
      let failCount = 0;

      // Process groups sequentially to respect 1 req/sec rate limit
      for (const group of groupsNeedingGeocode) {
        try {
          console.log(`Geocoding group "${group.name}" in ${group.city}, ${group.state}...`);
          
          const coords = await this.geocodeLocation(group.city, group.state);
          
          if (coords) {
            // Update the database with the geocoded coordinates
            await db.update(schema.warGroups)
              .set({
                latitude: coords.lat,
                longitude: coords.lng
              })
              .where(eq(schema.warGroups.id, group.id));
            
            successCount++;
            console.log(`✓ Successfully geocoded "${group.name}": ${coords.lat}, ${coords.lng}`);
          } else {
            failCount++;
            console.error(`✗ Failed to geocode "${group.name}" in ${group.city}, ${group.state}`);
          }
        } catch (error) {
          failCount++;
          console.error(`✗ Error geocoding "${group.name}":`, error);
        }
      }

      console.log(`War Groups geocoding complete: ${successCount} successful, ${failCount} failed`);

    } catch (error) {
      console.error('Error in war groups geocoding service:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Method to manually trigger geocoding (useful for testing or admin actions)
  async triggerGeocode() {
    console.log('Manually triggering war groups geocoding...');
    await this.geocodeAllGroups();
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      checkInterval: this.CHECK_INTERVAL,
      nextCheckIn: this.intervalId ? this.CHECK_INTERVAL : null
    };
  }
}

// Export singleton instance
export const warGroupsGeocodingService = new WarGroupsGeocodingService();
