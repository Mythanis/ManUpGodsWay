import { db } from './db';
import { users, rationTransactions, missions, userMissionProgress, RATION_RANKS } from '@shared/schema';
import type { RationRank, Mission, UserMissionProgress } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export class RationsService {
  
  /**
   * Award rations to a user for completing a mission (uses database missions with cap enforcement)
   */
  async awardRations(
    userId: string,
    missionKey: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; amount: number; newBalance: number; newRank?: RationRank; rankUp?: boolean; message?: string }> {
    // Look up mission from database
    const [mission] = await db.select().from(missions).where(eq(missions.missionKey, missionKey));
    if (!mission) {
      return { success: false, amount: 0, newBalance: 0, message: `Mission not found: ${missionKey}` };
    }

    if (!mission.isActive) {
      return { success: false, amount: 0, newBalance: 0, message: 'Mission is not active' };
    }

    const rationsToAward = mission.rations || 0;
    if (rationsToAward <= 0) {
      return { success: false, amount: 0, newBalance: 0, message: 'No rations configured for this mission' };
    }

    // Check and enforce cap if applicable
    if (mission.pointCap && mission.capDuration) {
      const capCheck = await this.checkAndUpdateMissionProgress(userId, mission, rationsToAward);
      if (!capCheck.canEarn) {
        return {
          success: false,
          amount: 0,
          newBalance: 0,
          message: capCheck.message || `Point cap reached for ${mission.name}. Resets in ${capCheck.daysUntilReset} days.`
        };
      }
    } else {
      // No cap - just update progress tracking
      await this.updateMissionProgressNoCap(userId, mission.id, rationsToAward);
    }

    // Get current user balance
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { success: false, amount: 0, newBalance: 0, message: 'User not found' };
    }

    const currentBalance = user.rations || 0;
    const newBalance = currentBalance + rationsToAward;
    const currentRank = user.rationRank as RationRank || 'recruit';
    const newRank = this.calculateRank(newBalance);
    const rankUp = newRank !== currentRank && RATION_RANKS[newRank].order > RATION_RANKS[currentRank].order;

    // Update user balance and rank
    await db.update(users)
      .set({ 
        rations: newBalance,
        rationRank: newRank,
      })
      .where(eq(users.id, userId));

    // Record transaction
    await db.insert(rationTransactions).values({
      userId,
      amount: rationsToAward,
      type: 'earn',
      category: mission.functionalArea.toLowerCase().replace(' ', '_'),
      missionType: missionKey,
      description: mission.description,
      referenceId,
      referenceType,
      balanceAfter: newBalance,
    });

    return {
      success: true,
      amount: rationsToAward,
      newBalance,
      newRank: rankUp ? newRank : undefined,
      rankUp,
    };
  }

  /**
   * Check if user can earn rations for a mission with cap, and update progress
   */
  private async checkAndUpdateMissionProgress(
    userId: string,
    mission: Mission,
    rationsToAward: number
  ): Promise<{ canEarn: boolean; message?: string; daysUntilReset?: number }> {
    const now = new Date();
    
    // Get or create user mission progress
    const [existingProgress] = await db.select()
      .from(userMissionProgress)
      .where(and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.missionId, mission.id)
      ));

    // Calculate if cap period has reset
    let shouldResetPeriod = !existingProgress;
    if (existingProgress && existingProgress.periodStartedAt && mission.capDuration) {
      const periodStart = new Date(existingProgress.periodStartedAt);
      const daysSincePeriodStart = Math.floor((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
      
      // If cap duration has passed, reset the period
      if (daysSincePeriodStart >= mission.capDuration) {
        shouldResetPeriod = true;
      }
    }

    if (shouldResetPeriod) {
      // Create new progress record (fresh period)
      await db.insert(userMissionProgress).values({
        userId,
        missionId: mission.id,
        rationsEarnedInPeriod: rationsToAward,
        timesCompletedInPeriod: 1,
        periodStartedAt: now,
        totalTimesCompleted: 1,
        totalRationsEarned: rationsToAward,
        lastCompletedAt: now,
      }).onConflictDoUpdate({
        target: [userMissionProgress.userId, userMissionProgress.missionId],
        set: {
          rationsEarnedInPeriod: rationsToAward,
          timesCompletedInPeriod: 1,
          periodStartedAt: now,
          totalTimesCompleted: sql`${userMissionProgress.totalTimesCompleted} + 1`,
          totalRationsEarned: sql`${userMissionProgress.totalRationsEarned} + ${rationsToAward}`,
          lastCompletedAt: now,
          updatedAt: now,
        }
      });
      return { canEarn: true };
    }

    // Check if adding this would exceed the cap
    const currentEarned = existingProgress.rationsEarnedInPeriod || 0;
    if (mission.pointCap && currentEarned + rationsToAward > mission.pointCap) {
      // Calculate days until reset
      const periodStart = new Date(existingProgress.periodStartedAt!);
      const daysSincePeriodStart = Math.floor((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntilReset = Math.max(0, (mission.capDuration || 0) - daysSincePeriodStart);
      
      return {
        canEarn: false,
        message: `Point cap (${mission.pointCap}) reached for ${mission.name}`,
        daysUntilReset
      };
    }

    // Update progress
    await db.update(userMissionProgress)
      .set({
        rationsEarnedInPeriod: currentEarned + rationsToAward,
        timesCompletedInPeriod: (existingProgress.timesCompletedInPeriod || 0) + 1,
        totalTimesCompleted: (existingProgress.totalTimesCompleted || 0) + 1,
        totalRationsEarned: (existingProgress.totalRationsEarned || 0) + rationsToAward,
        lastCompletedAt: now,
        updatedAt: now,
      })
      .where(eq(userMissionProgress.id, existingProgress.id));

    return { canEarn: true };
  }

  /**
   * Update mission progress for missions without caps
   */
  private async updateMissionProgressNoCap(
    userId: string,
    missionId: string,
    rationsEarned: number
  ): Promise<void> {
    const now = new Date();
    
    await db.insert(userMissionProgress).values({
      userId,
      missionId,
      rationsEarnedInPeriod: rationsEarned,
      timesCompletedInPeriod: 1,
      periodStartedAt: now,
      totalTimesCompleted: 1,
      totalRationsEarned: rationsEarned,
      lastCompletedAt: now,
    }).onConflictDoUpdate({
      target: [userMissionProgress.userId, userMissionProgress.missionId],
      set: {
        totalTimesCompleted: sql`${userMissionProgress.totalTimesCompleted} + 1`,
        totalRationsEarned: sql`${userMissionProgress.totalRationsEarned} + ${rationsEarned}`,
        lastCompletedAt: now,
        updatedAt: now,
      }
    });
  }

  /**
   * Spend rations (for purchases/redemptions)
   */
  async spendRations(
    userId: string,
    amount: number,
    category: string,
    description: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; newBalance: number; message?: string }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { success: false, newBalance: 0, message: 'User not found' };
    }

    const currentBalance = user.rations || 0;
    if (currentBalance < amount) {
      return { success: false, newBalance: currentBalance, message: 'Insufficient rations' };
    }

    const newBalance = currentBalance - amount;

    // Update user balance
    await db.update(users)
      .set({ rations: newBalance })
      .where(eq(users.id, userId));

    // Record transaction
    await db.insert(rationTransactions).values({
      userId,
      amount: -amount,
      type: 'spend',
      category,
      missionType: 'spend_' + category,
      description,
      referenceId,
      referenceType,
      balanceAfter: newBalance,
    });

    return { success: true, newBalance };
  }

  /**
   * Get user's ration balance and rank info
   */
  async getUserRations(userId: string): Promise<{
    balance: number;
    rank: RationRank;
    rankLabel: string;
    nextRank: RationRank | null;
    progressToNextRank: number;
    rationsToNextRank: number;
  }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return {
        balance: 0,
        rank: 'recruit',
        rankLabel: 'Recruit',
        nextRank: 'warrior',
        progressToNextRank: 0,
        rationsToNextRank: 1000,
      };
    }

    const balance = user.rations || 0;
    const rank = (user.rationRank as RationRank) || 'recruit';
    const rankInfo = RATION_RANKS[rank];
    
    // Find next rank
    const ranks = Object.entries(RATION_RANKS).sort((a, b) => a[1].order - b[1].order);
    const currentRankIndex = ranks.findIndex(([key]) => key === rank);
    const nextRankEntry = ranks[currentRankIndex + 1];
    const nextRank = nextRankEntry ? nextRankEntry[0] as RationRank : null;
    
    let progressToNextRank = 100;
    let rationsToNextRank = 0;
    
    if (nextRank) {
      const nextRankInfo = RATION_RANKS[nextRank];
      const rangeStart = rankInfo.min;
      const rangeEnd = nextRankInfo.min;
      const progress = balance - rangeStart;
      const total = rangeEnd - rangeStart;
      progressToNextRank = Math.min(100, Math.round((progress / total) * 100));
      rationsToNextRank = Math.max(0, rangeEnd - balance);
    }

    return {
      balance,
      rank,
      rankLabel: rankInfo.label,
      nextRank,
      progressToNextRank,
      rationsToNextRank,
    };
  }

  /**
   * Get user's transaction history
   */
  async getTransactionHistory(userId: string, limit: number = 50): Promise<typeof rationTransactions.$inferSelect[]> {
    return db.select()
      .from(rationTransactions)
      .where(eq(rationTransactions.userId, userId))
      .orderBy(desc(rationTransactions.createdAt))
      .limit(limit);
  }

  /**
   * Calculate rank based on ration balance
   */
  calculateRank(balance: number): RationRank {
    if (balance >= RATION_RANKS.elder.min) return 'elder';
    if (balance >= RATION_RANKS.watchman.min) return 'watchman';
    if (balance >= RATION_RANKS.shepherd.min) return 'shepherd';
    if (balance >= RATION_RANKS.warrior.min) return 'warrior';
    return 'recruit';
  }

  /**
   * Check if user is eligible for grace bonus (returned after 14+ days inactivity)
   */
  async checkGraceBonus(userId: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.lastActiveDate) return false;

    const daysSinceActive = Math.floor(
      (Date.now() - new Date(user.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceActive >= 14;
  }

  /**
   * Award grace bonus for returning user
   */
  async awardGraceBonus(userId: string): Promise<{ success: boolean; amount: number; newBalance: number }> {
    const isEligible = await this.checkGraceBonus(userId);
    if (!isEligible) {
      return { success: false, amount: 0, newBalance: 0 };
    }

    return this.awardRations(userId, 'grace_bonus');
  }

  /**
   * Get leaderboard of top users by rations
   */
  async getLeaderboard(limit: number = 50): Promise<Array<{
    userId: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    rations: number;
    rank: string;
  }>> {
    const topUsers = await db.select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
      rations: users.rations,
      rank: users.rationRank,
    })
      .from(users)
      .where(sql`${users.rations} > 0`)
      .orderBy(desc(users.rations))
      .limit(limit);

    return topUsers.map(u => ({
      ...u,
      rations: u.rations || 0,
      rank: u.rank || 'recruit',
    }));
  }

  /**
   * Award rations with a custom amount (for content-specific rewards)
   */
  async awardCustomRations(
    userId: string,
    amount: number,
    category: string,
    description: string,
    missionType: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; amount: number; newBalance: number; newRank?: RationRank; rankUp?: boolean }> {
    if (amount <= 0) {
      return { success: false, amount: 0, newBalance: 0 };
    }

    // Get current user balance
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { success: false, amount: 0, newBalance: 0 };
    }

    const currentBalance = user.rations || 0;
    const newBalance = currentBalance + amount;
    const currentRank = user.rationRank as RationRank || 'recruit';
    const newRank = this.calculateRank(newBalance);
    const rankUp = newRank !== currentRank && RATION_RANKS[newRank].order > RATION_RANKS[currentRank].order;

    // Update user balance and rank
    await db.update(users)
      .set({ 
        rations: newBalance,
        rationRank: newRank,
      })
      .where(eq(users.id, userId));

    // Record transaction
    await db.insert(rationTransactions).values({
      userId,
      amount,
      type: 'earn',
      category,
      missionType,
      description,
      referenceId,
      referenceType,
      balanceAfter: newBalance,
    });

    return {
      success: true,
      amount,
      newBalance,
      newRank: rankUp ? newRank : undefined,
      rankUp,
    };
  }

  /**
   * Admin: Manually adjust user rations
   */
  async adminAdjustRations(
    adminUserId: string,
    targetUserId: string,
    amount: number,
    reason: string
  ): Promise<{ success: boolean; newBalance: number; message?: string }> {
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId));
    if (!targetUser) {
      return { success: false, newBalance: 0, message: 'User not found' };
    }

    const currentBalance = targetUser.rations || 0;
    const newBalance = Math.max(0, currentBalance + amount);
    const newRank = this.calculateRank(newBalance);

    // Update user balance and rank
    await db.update(users)
      .set({ 
        rations: newBalance,
        rationRank: newRank,
      })
      .where(eq(users.id, targetUserId));

    // Record transaction
    await db.insert(rationTransactions).values({
      userId: targetUserId,
      amount,
      type: amount >= 0 ? 'admin_grant' : 'admin_deduct',
      category: 'admin',
      missionType: 'admin_adjustment',
      description: `Admin adjustment: ${reason}`,
      referenceId: adminUserId,
      referenceType: 'admin_user',
      balanceAfter: newBalance,
    });

    return { success: true, newBalance };
  }

  /**
   * Check and award streak bonuses
   */
  async checkAndAwardStreakBonus(
    userId: string, 
    streakType: 'study' | 'devotional',
    currentStreak: number
  ): Promise<{ awarded: boolean; missionKey?: string; amount?: number }> {
    if (streakType === 'study') {
      if (currentStreak === 7) {
        const result = await this.awardRations(userId, 'study_streak_7');
        return { awarded: result.success, missionKey: 'study_streak_7', amount: result.amount };
      }
      if (currentStreak === 30) {
        const result = await this.awardRations(userId, 'study_streak_30');
        return { awarded: result.success, missionKey: 'study_streak_30', amount: result.amount };
      }
    }
    
    if (streakType === 'devotional') {
      if (currentStreak === 7) {
        const result = await this.awardRations(userId, 'devotional_streak_7');
        return { awarded: result.success, missionKey: 'devotional_streak_7', amount: result.amount };
      }
      if (currentStreak === 30) {
        const result = await this.awardRations(userId, 'devotional_streak_30');
        return { awarded: result.success, missionKey: 'devotional_streak_30', amount: result.amount };
      }
    }

    return { awarded: false };
  }

  /**
   * Get all missions from database
   */
  async getAllMissions(): Promise<Mission[]> {
    return db.select().from(missions).orderBy(missions.functionalArea, missions.name);
  }

  /**
   * Get mission by key
   */
  async getMissionByKey(missionKey: string): Promise<Mission | null> {
    const [mission] = await db.select().from(missions).where(eq(missions.missionKey, missionKey));
    return mission || null;
  }

  /**
   * Update mission configuration (admin only)
   */
  async updateMission(
    missionId: string,
    updates: Partial<Pick<Mission, 'rations' | 'pointCap' | 'capDuration' | 'activity' | 'isActive'>>
  ): Promise<Mission | null> {
    const [updated] = await db.update(missions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(missions.id, missionId))
      .returning();
    
    return updated || null;
  }

  /**
   * Get user's mission progress
   */
  async getUserMissionProgress(userId: string): Promise<UserMissionProgress[]> {
    return db.select()
      .from(userMissionProgress)
      .where(eq(userMissionProgress.userId, userId));
  }
}

export const rationsService = new RationsService();
