import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, sql, desc, asc, like, or, ilike } from "drizzle-orm";
import type { 
  WarGroup, InsertWarGroup, 
  WarGroupMember, InsertWarGroupMember,
  WarGroupPost, InsertWarGroupPost,
  WarGroupWarRoomPost, InsertWarGroupWarRoomPost,
  WarGroupChallenge, InsertWarGroupChallenge,
  WarGroupAnnouncement, InsertWarGroupAnnouncement
} from "@shared/schema";

// In-memory cache for geocoded locations (shared with geocoding service)
export const geocodeCache = new Map<string, { lat: number; lng: number }>();

// Helper function to geocode a location (exported for use by geocoding service)
export async function geocodeLocation(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `${city.toLowerCase()},${state.toLowerCase()}`;
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    console.log(`Geocode cache hit for ${city}, ${state}`);
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
      console.log(`Successfully geocoded ${city}, ${state}: ${coords.lat}, ${coords.lng}`);
      
      return coords;
    }
    
    console.warn(`No geocoding results found for ${city}, ${state}`);
    return null;
  } catch (error) {
    console.error(`Error geocoding ${city}, ${state}:`, error);
    return null;
  }
}

export class WarGroupsService {
  
  async getAllGroups(search?: string, city?: string, state?: string) {
    let query = db.select({
      group: schema.warGroups,
      leader: {
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        profileImageUrl: schema.users.profileImageUrl,
      }
    })
    .from(schema.warGroups)
    .leftJoin(schema.users, eq(schema.warGroups.leaderId, schema.users.id))
    .where(and(
      eq(schema.warGroups.isActive, true),
      eq(schema.warGroups.isLicensed, true) // Only show licensed groups
    ));

    const results = await query;
    
    // Apply filters in memory for now (could be optimized with SQL WHERE clauses)
    let filteredResults = results;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredResults = filteredResults.filter(r => 
        r.group.name.toLowerCase().includes(searchLower) ||
        r.group.city.toLowerCase().includes(searchLower) ||
        r.group.description?.toLowerCase().includes(searchLower)
      );
    }
    
    if (city) {
      filteredResults = filteredResults.filter(r => 
        r.group.city.toLowerCase() === city.toLowerCase()
      );
    }
    
    if (state) {
      filteredResults = filteredResults.filter(r => 
        r.group.state.toLowerCase() === state.toLowerCase()
      );
    }
    
    // Return groups immediately
    // Geocoding is handled by the background warGroupsGeocodingService
    return filteredResults.map(r => ({
      ...r.group,
      leader: r.leader
    }));
  }

  async getGroupById(groupId: string) {
    const result = await db.select({
      group: schema.warGroups,
      leader: {
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        profileImageUrl: schema.users.profileImageUrl,
      }
    })
    .from(schema.warGroups)
    .leftJoin(schema.users, eq(schema.warGroups.leaderId, schema.users.id))
    .where(eq(schema.warGroups.id, groupId))
    .limit(1);
    
    if (!result.length) {
      return null;
    }
    
    const group = result[0].group;
    
    // Return group data
    // Geocoding is handled by the background warGroupsGeocodingService
    return {
      ...group,
      leader: result[0].leader
    };
  }

  async getUserGroupMembership(userId: string, groupId: string) {
    const membership = await db.select()
      .from(schema.warGroupMembers)
      .where(and(
        eq(schema.warGroupMembers.userId, userId),
        eq(schema.warGroupMembers.groupId, groupId)
      ))
      .limit(1);
    
    return membership[0] || null;
  }

  async getGroupMembers(groupId: string, status?: string) {
    const whereConditions = status
      ? and(
          eq(schema.warGroupMembers.groupId, groupId),
          eq(schema.warGroupMembers.status, status)
        )
      : eq(schema.warGroupMembers.groupId, groupId);
    
    const results = await db.select({
      membership: schema.warGroupMembers,
      user: {
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        profileImageUrl: schema.users.profileImageUrl,
        email: schema.users.email,
      }
    })
    .from(schema.warGroupMembers)
    .leftJoin(schema.users, eq(schema.warGroupMembers.userId, schema.users.id))
    .where(whereConditions);
    
    return results.map(r => ({
      ...r.membership,
      user: r.user
    }));
  }

  async requestToJoinGroup(userId: string, groupId: string) {
    const existing = await this.getUserGroupMembership(userId, groupId);
    if (existing) {
      throw new Error('You already have a membership request for this group');
    }
    
    const newMembership = await db.insert(schema.warGroupMembers).values({
      userId,
      groupId,
      status: 'pending',
      role: 'member',
    }).returning();
    
    return newMembership[0];
  }

  async approveMemberRequest(membershipId: string, leaderId: string) {
    // Verify leader has permission
    const membership = await db.select()
      .from(schema.warGroupMembers)
      .where(eq(schema.warGroupMembers.id, membershipId))
      .limit(1);
    
    if (!membership.length) {
      throw new Error('Membership request not found');
    }
    
    const group = await this.getGroupById(membership[0].groupId);
    if (!group || group.leaderId !== leaderId) {
      throw new Error('Only the group leader can approve members');
    }
    
    const updated = await db.update(schema.warGroupMembers)
      .set({
        status: 'approved',
        joinedAt: new Date(),
      })
      .where(eq(schema.warGroupMembers.id, membershipId))
      .returning();
    
    // Update group member count
    await db.update(schema.warGroups)
      .set({
        memberCount: sql`${schema.warGroups.memberCount} + 1`,
      })
      .where(eq(schema.warGroups.id, membership[0].groupId));
    
    return updated[0];
  }

  async removeMember(membershipId: string, leaderId: string) {
    const membership = await db.select()
      .from(schema.warGroupMembers)
      .where(eq(schema.warGroupMembers.id, membershipId))
      .limit(1);
    
    if (!membership.length) {
      throw new Error('Membership not found');
    }
    
    const group = await this.getGroupById(membership[0].groupId);
    if (!group || group.leaderId !== leaderId) {
      throw new Error('Only the group leader can remove members');
    }
    
    await db.delete(schema.warGroupMembers)
      .where(eq(schema.warGroupMembers.id, membershipId));
    
    // Update group member count
    if (membership[0].status === 'approved') {
      await db.update(schema.warGroups)
        .set({
          memberCount: sql`${schema.warGroups.memberCount} - 1`,
        })
        .where(eq(schema.warGroups.id, membership[0].groupId));
    }
  }

  async createGroup(groupData: InsertWarGroup) {
    // Geocode the group location immediately on creation
    console.log(`Creating group "${groupData.name}" in ${groupData.city}, ${groupData.state}`);
    
    let latitude = groupData.latitude;
    let longitude = groupData.longitude;
    let geocodeFailureCount = 0;
    let needsGeocode = false;
    
    // If coordinates not provided, geocode now
    if (!latitude || !longitude) {
      console.log(`Geocoding group location for ${groupData.city}, ${groupData.state}...`);
      const coords = await geocodeLocation(groupData.city, groupData.state);
      
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
        geocodeFailureCount = 0;
        needsGeocode = false;
        console.log(`✓ Group geocoded successfully: ${coords.lat}, ${coords.lng}`);
      } else {
        // Geocoding failed, mark for background retry
        geocodeFailureCount = 1;
        needsGeocode = true;
        console.warn(`✗ Failed to geocode group on creation - marked for background retry`);
      }
    }
    
    const newGroup = await db.insert(schema.warGroups).values({
      ...groupData,
      latitude,
      longitude,
      needsGeocode,
      geocodeFailureCount,
      lastGeocodeAttempt: new Date(),
    }).returning();
    
    // Automatically add leader as approved member
    await db.insert(schema.warGroupMembers).values({
      groupId: newGroup[0].id,
      userId: groupData.leaderId,
      status: 'approved',
      role: 'leader',
      joinedAt: new Date(),
    });
    
    return newGroup[0];
  }

  async updateGroup(groupId: string, groupData: Partial<InsertWarGroup>, userId: string) {
    // Verify user is leader
    const group = await this.getGroupById(groupId);
    if (!group || group.leaderId !== userId) {
      throw new Error('Only the group leader can update group information');
    }
    
    // Check if city or state is being updated (handle partial updates)
    const newCity = groupData.city !== undefined ? groupData.city : group.city;
    const newState = groupData.state !== undefined ? groupData.state : group.state;
    const cityChanged = groupData.city !== undefined && groupData.city !== group.city;
    const stateChanged = groupData.state !== undefined && groupData.state !== group.state;
    
    let updateData: any = {
      ...groupData,
      updatedAt: new Date(),
    };
    
    // If either city OR state changed, re-geocode with the complete location
    if (cityChanged || stateChanged) {
      console.log(`Group location changed, re-geocoding ${newCity}, ${newState}...`);
      const coords = await geocodeLocation(newCity, newState);
      
      if (coords) {
        updateData.latitude = coords.lat;
        updateData.longitude = coords.lng;
        updateData.needsGeocode = false;
        updateData.geocodeFailureCount = 0;
        updateData.lastGeocodeAttempt = new Date();
        console.log(`✓ Group re-geocoded successfully: ${coords.lat}, ${coords.lng}`);
      } else {
        // Geocoding failed, mark for background retry
        updateData.latitude = null;
        updateData.longitude = null;
        updateData.needsGeocode = true;
        updateData.geocodeFailureCount = 1;
        updateData.lastGeocodeAttempt = new Date();
        console.warn(`✗ Failed to geocode updated location - marked for background retry`);
      }
    }
    
    const updated = await db.update(schema.warGroups)
      .set(updateData)
      .where(eq(schema.warGroups.id, groupId))
      .returning();
    
    return updated[0];
  }

  async getUserGroups(userId: string) {
    const memberships = await db.select({
      membership: schema.warGroupMembers,
      group: schema.warGroups,
      leader: {
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
      }
    })
    .from(schema.warGroupMembers)
    .leftJoin(schema.warGroups, eq(schema.warGroupMembers.groupId, schema.warGroups.id))
    .leftJoin(schema.users, eq(schema.warGroups.leaderId, schema.users.id))
    .where(and(
      eq(schema.warGroupMembers.userId, userId),
      eq(schema.warGroupMembers.status, 'approved')
    ));
    
    return memberships.map(m => ({
      ...m.group,
      leader: m.leader,
      membershipRole: m.membership.role,
    }));
  }

  async getAllGroupsForAdmin() {
    const results = await db.select({
      group: schema.warGroups,
      leader: {
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        profileImageUrl: schema.users.profileImageUrl,
      }
    })
    .from(schema.warGroups)
    .leftJoin(schema.users, eq(schema.warGroups.leaderId, schema.users.id))
    .where(eq(schema.warGroups.isActive, true))
    .orderBy(desc(schema.warGroups.createdAt));

    const groupsWithStats = await Promise.all(results.map(async (r) => {
      const memberCount = await db.select({ count: sql<number>`count(*)` })
        .from(schema.warGroupMembers)
        .where(and(
          eq(schema.warGroupMembers.groupId, r.group.id),
          eq(schema.warGroupMembers.status, 'approved')
        ));

      return {
        ...r.group,
        leader: r.leader,
        memberCount: Number(memberCount[0].count)
      };
    }));

    return groupsWithStats;
  }

  async changeGroupLeader(groupId: string, newLeaderId: string) {
    const group = await this.getGroupById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const oldLeaderId = group.leaderId;

    const updated = await db.update(schema.warGroups)
      .set({
        leaderId: newLeaderId,
        updatedAt: new Date()
      })
      .where(eq(schema.warGroups.id, groupId))
      .returning();

    const existingMembership = await db.select()
      .from(schema.warGroupMembers)
      .where(and(
        eq(schema.warGroupMembers.groupId, groupId),
        eq(schema.warGroupMembers.userId, newLeaderId)
      ));

    if (existingMembership.length > 0) {
      await db.update(schema.warGroupMembers)
        .set({
          role: 'leader',
          status: 'approved',
          joinedAt: new Date()
        })
        .where(and(
          eq(schema.warGroupMembers.groupId, groupId),
          eq(schema.warGroupMembers.userId, newLeaderId)
        ));
    } else {
      await db.insert(schema.warGroupMembers).values({
        userId: newLeaderId,
        groupId,
        role: 'leader',
        status: 'approved',
        joinedAt: new Date()
      });
    }

    await db.update(schema.warGroupMembers)
      .set({
        role: 'member'
      })
      .where(and(
        eq(schema.warGroupMembers.groupId, groupId),
        eq(schema.warGroupMembers.userId, oldLeaderId)
      ));

    return updated[0];
  }

  async removeMemberFromGroup(groupId: string, userId: string) {
    await db.delete(schema.warGroupMembers)
      .where(and(
        eq(schema.warGroupMembers.groupId, groupId),
        eq(schema.warGroupMembers.userId, userId)
      ));

    return { success: true };
  }

  async getAllUsers(search?: string) {
    let query = db.select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      email: schema.users.email,
      profileImageUrl: schema.users.profileImageUrl
    })
    .from(schema.users);

    const results = await query;

    if (search) {
      const searchLower = search.toLowerCase();
      return results.filter(u => 
        u.firstName?.toLowerCase().includes(searchLower) ||
        u.lastName?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower)
      );
    }

    return results;
  }
}

export const warGroupsService = new WarGroupsService();
