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
  
  // Calculate distance between two points using Haversine formula (returns miles)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  async getAllGroups(search?: string, city?: string, state?: string, distance?: number) {
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
    
    // If city is provided with distance, do distance-based filtering
    // Distance takes priority - state is only used to pinpoint the search location
    if (city && distance !== undefined && distance > 0) {
      // Get coordinates for the search city+state combination
      const searchState = state || 'USA';
      const searchCoords = await geocodeLocation(city, searchState);
      
      if (searchCoords) {
        // Filter groups within the specified distance (any state within radius)
        filteredResults = filteredResults.filter(r => {
          // If group has coordinates, calculate distance
          if (r.group.latitude && r.group.longitude) {
            const dist = this.calculateDistance(
              searchCoords.lat,
              searchCoords.lng,
              r.group.latitude,
              r.group.longitude
            );
            return dist <= distance;
          }
          // If no coordinates, fall back to exact city+state match
          const cityMatch = r.group.city.toLowerCase() === city.toLowerCase();
          const stateMatch = !state || r.group.state.toLowerCase() === state.toLowerCase();
          return cityMatch && stateMatch;
        });
      } else {
        // Fallback to exact city+state match if geocoding fails
        filteredResults = filteredResults.filter(r => {
          const cityMatch = r.group.city.toLowerCase() === city.toLowerCase();
          const stateMatch = !state || r.group.state.toLowerCase() === state.toLowerCase();
          return cityMatch && stateMatch;
        });
      }
    } else if (city) {
      // No distance specified, do exact city match (and state if provided)
      filteredResults = filteredResults.filter(r => {
        const cityMatch = r.group.city.toLowerCase() === city.toLowerCase();
        const stateMatch = !state || r.group.state.toLowerCase() === state.toLowerCase();
        return cityMatch && stateMatch;
      });
    } else if (state) {
      // Only state provided, filter by state
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

  async canUserManageMembers(userId: string, groupId: string): Promise<boolean> {
    const group = await this.getGroupById(groupId);
    if (!group) return false;
    
    // Leader always has permission
    if (group.leaderId === userId) return true;
    
    // Check if user has canManageMembers permission
    const membership = await this.getUserGroupMembership(userId, groupId);
    return membership?.canManageMembers === true && membership?.status === 'approved';
  }

  async approveMemberRequest(membershipId: string, managerId: string) {
    // Verify manager has permission
    const membership = await db.select()
      .from(schema.warGroupMembers)
      .where(eq(schema.warGroupMembers.id, membershipId))
      .limit(1);
    
    if (!membership.length) {
      throw new Error('Membership request not found');
    }
    
    const canManage = await this.canUserManageMembers(managerId, membership[0].groupId);
    if (!canManage) {
      throw new Error('You do not have permission to approve members');
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

  async rejectMemberRequest(membershipId: string, managerId: string) {
    const membership = await db.select()
      .from(schema.warGroupMembers)
      .where(eq(schema.warGroupMembers.id, membershipId))
      .limit(1);
    
    if (!membership.length) {
      throw new Error('Membership request not found');
    }
    
    const canManage = await this.canUserManageMembers(managerId, membership[0].groupId);
    if (!canManage) {
      throw new Error('You do not have permission to reject members');
    }
    
    await db.delete(schema.warGroupMembers)
      .where(eq(schema.warGroupMembers.id, membershipId));
  }

  async getPendingMemberRequests(groupId: string, managerId: string) {
    const canManage = await this.canUserManageMembers(managerId, groupId);
    if (!canManage) {
      throw new Error('You do not have permission to view pending requests');
    }
    
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
    .where(and(
      eq(schema.warGroupMembers.groupId, groupId),
      eq(schema.warGroupMembers.status, 'pending')
    ));
    
    return results.map(r => ({
      ...r.membership,
      user: r.user
    }));
  }

  async removeMember(membershipId: string, managerId: string) {
    const membership = await db.select()
      .from(schema.warGroupMembers)
      .where(eq(schema.warGroupMembers.id, membershipId))
      .limit(1);
    
    if (!membership.length) {
      throw new Error('Membership not found');
    }
    
    const canManage = await this.canUserManageMembers(managerId, membership[0].groupId);
    if (!canManage) {
      throw new Error('You do not have permission to remove members');
    }
    
    // Don't allow removing the leader
    const group = await this.getGroupById(membership[0].groupId);
    if (group && membership[0].userId === group.leaderId) {
      throw new Error('Cannot remove the group leader');
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

  async getApprovedMembers(groupId: string, managerId: string) {
    const canManage = await this.canUserManageMembers(managerId, groupId);
    if (!canManage) {
      throw new Error('You do not have permission to view members');
    }
    
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
    .where(and(
      eq(schema.warGroupMembers.groupId, groupId),
      eq(schema.warGroupMembers.status, 'approved')
    ));
    
    return results.map(r => ({
      ...r.membership,
      user: r.user
    }));
  }

  async toggleMemberManagePermission(membershipId: string, leaderId: string) {
    // Only the leader can assign management permissions
    const membership = await db.select()
      .from(schema.warGroupMembers)
      .where(eq(schema.warGroupMembers.id, membershipId))
      .limit(1);
    
    if (!membership.length) {
      throw new Error('Membership not found');
    }
    
    const group = await this.getGroupById(membership[0].groupId);
    if (!group || group.leaderId !== leaderId) {
      throw new Error('Only the group leader can assign management permissions');
    }
    
    // Don't allow toggling for the leader themselves
    if (membership[0].userId === leaderId) {
      throw new Error('Cannot modify leader permissions');
    }
    
    const newValue = !membership[0].canManageMembers;
    const updated = await db.update(schema.warGroupMembers)
      .set({
        canManageMembers: newValue,
        updatedAt: new Date(),
      })
      .where(eq(schema.warGroupMembers.id, membershipId))
      .returning();
    
    return updated[0];
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

  // War Group Registration Methods
  async createRegistration(data: schema.InsertWarGroupRegistration & { requestedBy: string }) {
    const [registration] = await db.insert(schema.warGroupRegistrations)
      .values(data)
      .returning();
    return registration;
  }

  async getAllRegistrations(status?: string) {
    let query = db.select({
      registration: schema.warGroupRegistrations,
      requester: {
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        profileImageUrl: schema.users.profileImageUrl
      }
    })
    .from(schema.warGroupRegistrations)
    .leftJoin(
      schema.users,
      eq(schema.warGroupRegistrations.requestedBy, schema.users.id)
    )
    .orderBy(desc(schema.warGroupRegistrations.createdAt));

    if (status) {
      const results = await query;
      return results.filter(r => r.registration.status === status);
    }

    return query;
  }

  async approveRegistration(registrationId: string, reviewerId: string) {
    const [registration] = await db.select()
      .from(schema.warGroupRegistrations)
      .where(eq(schema.warGroupRegistrations.id, registrationId))
      .limit(1);

    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.status !== 'pending') {
      throw new Error('Registration has already been reviewed');
    }

    // Create the war group
    const [newGroup] = await db.insert(schema.warGroups)
      .values({
        name: registration.name,
        city: registration.city,
        state: registration.state,
        description: registration.description,
        meetingInfo: registration.meetingInfo,
        leaderId: registration.requestedBy,
        isActive: true,
        isLicensed: false,
        needsGeocode: true
      })
      .returning();

    // Create leader membership
    await db.insert(schema.warGroupMembers).values({
      groupId: newGroup.id,
      userId: registration.requestedBy,
      role: 'leader',
      status: 'approved',
      joinedAt: new Date()
    });

    // Try to geocode synchronously
    try {
      const coords = await geocodeLocation(newGroup.city, newGroup.state);
      if (coords) {
        await db.update(schema.warGroups)
          .set({
            latitude: coords.lat,
            longitude: coords.lng,
            needsGeocode: false,
            geocodeFailureCount: 0
          })
          .where(eq(schema.warGroups.id, newGroup.id));
      }
    } catch (error) {
      console.error('Geocoding failed during registration approval:', error);
    }

    // Update registration status
    await db.update(schema.warGroupRegistrations)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date()
      })
      .where(eq(schema.warGroupRegistrations.id, registrationId));

    return newGroup;
  }

  async rejectRegistration(registrationId: string, reviewerId: string, reason: string) {
    const [registration] = await db.select()
      .from(schema.warGroupRegistrations)
      .where(eq(schema.warGroupRegistrations.id, registrationId))
      .limit(1);

    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.status !== 'pending') {
      throw new Error('Registration has already been reviewed');
    }

    await db.update(schema.warGroupRegistrations)
      .set({
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason
      })
      .where(eq(schema.warGroupRegistrations.id, registrationId));

    return { success: true };
  }

  // War Group Posts (Private Discussion Board)
  async getGroupPosts(groupId: string, userId: string, limit = 50, offset = 0) {
    // Verify user is a member
    const membership = await this.getUserGroupMembership(userId, groupId);
    if (!membership || membership.status !== 'approved') {
      throw new Error('Only approved members can view group posts');
    }

    const posts = await db.select({
      post: schema.warGroupPosts,
      user: {
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        profileImageUrl: schema.users.profileImageUrl,
      }
    })
    .from(schema.warGroupPosts)
    .leftJoin(schema.users, eq(schema.warGroupPosts.userId, schema.users.id))
    .where(eq(schema.warGroupPosts.groupId, groupId))
    .orderBy(desc(schema.warGroupPosts.isPinned), desc(schema.warGroupPosts.createdAt))
    .limit(limit)
    .offset(offset);

    return posts.map(p => ({
      ...p.post,
      user: p.user
    }));
  }

  async createGroupPost(
    groupId: string, 
    userId: string, 
    content: string, 
    postType = 'discussion',
    mediaUrls?: string[],
    mediaTypes?: string[]
  ) {
    // Verify user is a member
    const membership = await this.getUserGroupMembership(userId, groupId);
    if (!membership || membership.status !== 'approved') {
      throw new Error('Only approved members can post in this group');
    }

    const [newPost] = await db.insert(schema.warGroupPosts).values({
      groupId,
      userId,
      content,
      postType: mediaUrls && mediaUrls.length > 0 ? 'media' : postType,
      mediaUrls: mediaUrls || null,
      mediaTypes: mediaTypes || null,
    }).returning();

    return newPost;
  }

  async likeGroupPost(postId: string, userId: string) {
    // Get the post to verify group membership
    const [post] = await db.select()
      .from(schema.warGroupPosts)
      .where(eq(schema.warGroupPosts.id, postId))
      .limit(1);

    if (!post) {
      throw new Error('Post not found');
    }

    const membership = await this.getUserGroupMembership(userId, post.groupId);
    if (!membership || membership.status !== 'approved') {
      throw new Error('Only approved members can like posts');
    }

    await db.update(schema.warGroupPosts)
      .set({ likes: sql`${schema.warGroupPosts.likes} + 1` })
      .where(eq(schema.warGroupPosts.id, postId));

    return { success: true };
  }

  async deleteGroupPost(postId: string, userId: string) {
    const [post] = await db.select()
      .from(schema.warGroupPosts)
      .where(eq(schema.warGroupPosts.id, postId))
      .limit(1);

    if (!post) {
      throw new Error('Post not found');
    }

    // Check if user is the author or the group leader
    const group = await this.getGroupById(post.groupId);
    if (post.userId !== userId && group?.leaderId !== userId) {
      throw new Error('Only post author or group leader can delete posts');
    }

    await db.delete(schema.warGroupPosts)
      .where(eq(schema.warGroupPosts.id, postId));

    return { success: true };
  }

  async getPostReplies(postId: string, userId: string) {
    const [post] = await db.select()
      .from(schema.warGroupPosts)
      .where(eq(schema.warGroupPosts.id, postId))
      .limit(1);

    if (!post) {
      throw new Error('Post not found');
    }

    const membership = await this.getUserGroupMembership(userId, post.groupId);
    if (!membership || membership.status !== 'approved') {
      throw new Error('Only approved members can view replies');
    }

    const replies = await db.select({
      reply: schema.warGroupPostReplies,
      user: {
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        profileImageUrl: schema.users.profileImageUrl,
      }
    })
    .from(schema.warGroupPostReplies)
    .leftJoin(schema.users, eq(schema.warGroupPostReplies.userId, schema.users.id))
    .where(eq(schema.warGroupPostReplies.postId, postId))
    .orderBy(schema.warGroupPostReplies.createdAt);

    return replies.map(r => ({
      ...r.reply,
      user: r.user
    }));
  }

  async createPostReply(postId: string, userId: string, content: string) {
    const [post] = await db.select()
      .from(schema.warGroupPosts)
      .where(eq(schema.warGroupPosts.id, postId))
      .limit(1);

    if (!post) {
      throw new Error('Post not found');
    }

    const membership = await this.getUserGroupMembership(userId, post.groupId);
    if (!membership || membership.status !== 'approved') {
      throw new Error('Only approved members can reply to posts');
    }

    const [newReply] = await db.insert(schema.warGroupPostReplies).values({
      postId,
      userId,
      content,
    }).returning();

    // Update reply count
    await db.update(schema.warGroupPosts)
      .set({ replyCount: sql`${schema.warGroupPosts.replyCount} + 1` })
      .where(eq(schema.warGroupPosts.id, postId));

    return newReply;
  }

  async togglePinPost(postId: string, userId: string) {
    const [post] = await db.select()
      .from(schema.warGroupPosts)
      .where(eq(schema.warGroupPosts.id, postId))
      .limit(1);

    if (!post) {
      throw new Error('Post not found');
    }

    const group = await this.getGroupById(post.groupId);
    if (group?.leaderId !== userId) {
      throw new Error('Only group leader can pin posts');
    }

    await db.update(schema.warGroupPosts)
      .set({ isPinned: !post.isPinned })
      .where(eq(schema.warGroupPosts.id, postId));

    return { success: true, isPinned: !post.isPinned };
  }
}

export const warGroupsService = new WarGroupsService();
