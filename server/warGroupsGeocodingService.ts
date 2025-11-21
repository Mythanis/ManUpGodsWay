import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, or, and, isNull, sql } from "drizzle-orm";
import { geocodeLocation } from "./warGroupsService";

// Service to automatically geocode war groups missing coordinates
class WarGroupsGeocodingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isProcessing = false;

  // Check every 2 minutes for groups needing geocoding (fast iteration for new groups)
  private readonly CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes in milliseconds
  private readonly MAX_FAILURE_COUNT = 5; // Stop retrying after 5 failures

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

    console.log(`War Groups geocoding service started - checking every ${this.CHECK_INTERVAL / 1000 / 60} minutes`);
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

  private async geocodeAllGroups() {
    if (this.isProcessing) {
      console.log('Geocoding already in progress, skipping this run');
      return;
    }

    this.isProcessing = true;

    try {
      console.log('Checking for war groups that need geocoding...');
      
      // Get all groups that need geocoding (explicit flag) and haven't exceeded max failures
      const groupsNeedingGeocode = await db.select()
        .from(schema.warGroups)
        .where(
          and(
            eq(schema.warGroups.needsGeocode, true),
            or(
              isNull(schema.warGroups.geocodeFailureCount),
              sql`${schema.warGroups.geocodeFailureCount} < ${this.MAX_FAILURE_COUNT}`
            )
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
          
          const coords = await geocodeLocation(group.city, group.state);
          
          // Add delay to respect Nominatim's 1 req/sec limit
          await new Promise(resolve => setTimeout(resolve, 1100));
          
          if (coords) {
            // Update with coordinates, mark as geocoded, reset failure count
            await db.update(schema.warGroups)
              .set({
                latitude: coords.lat,
                longitude: coords.lng,
                needsGeocode: false,
                geocodeFailureCount: 0,
                lastGeocodeAttempt: new Date()
              })
              .where(eq(schema.warGroups.id, group.id));
            
            successCount++;
            console.log(`✓ Successfully geocoded "${group.name}": ${coords.lat}, ${coords.lng}`);
          } else {
            // Increment failure count
            const currentFailures = group.geocodeFailureCount || 0;
            const newFailureCount = currentFailures + 1;
            
            await db.update(schema.warGroups)
              .set({
                geocodeFailureCount: newFailureCount,
                lastGeocodeAttempt: new Date()
              })
              .where(eq(schema.warGroups.id, group.id));
            
            failCount++;
            if (newFailureCount >= this.MAX_FAILURE_COUNT) {
              console.error(`✗ PERMANENT FAILURE: "${group.name}" in ${group.city}, ${group.state} - Max retries (${this.MAX_FAILURE_COUNT}) reached`);
            } else {
              console.error(`✗ Failed to geocode "${group.name}" in ${group.city}, ${group.state} (attempt ${newFailureCount}/${this.MAX_FAILURE_COUNT})`);
            }
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
