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
    
    return {
      ...result[0].group,
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
    const newGroup = await db.insert(schema.warGroups).values(groupData).returning();
    
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
    
    const updated = await db.update(schema.warGroups)
      .set({
        ...groupData,
        updatedAt: new Date(),
      })
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
}

export const warGroupsService = new WarGroupsService();
