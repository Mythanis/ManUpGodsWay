import { db } from './db';
import { users, rationTransactions, dailyMissionLimits, MISSION_REWARDS, RATION_RANKS, DAILY_MISSION_LIMITS } from '@shared/schema';
import type { MissionType, RationRank } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export class RationsService {
  
  /**
   * Award rations to a user for completing a mission
   */
  async awardRations(
    userId: string,
    missionType: MissionType,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; amount: number; newBalance: number; newRank?: RationRank; rankUp?: boolean; message?: string }> {
    const mission = MISSION_REWARDS[missionType];
    if (!mission) {
      return { success: false, amount: 0, newBalance: 0, message: 'Invalid mission type' };
    }

    // Check daily limits for rate-limited missions
    const dailyLimit = DAILY_MISSION_LIMITS[missionType as keyof typeof DAILY_MISSION_LIMITS];
    if (dailyLimit) {
      const today = new Date().toISOString().split('T')[0];
      const [existingLimit] = await db.select()
        .from(dailyMissionLimits)
        .where(
          and(
            eq(dailyMissionLimits.userId, userId),
            eq(dailyMissionLimits.missionType, missionType),
            eq(dailyMissionLimits.date, today)
          )
        );

      if (existingLimit && existingLimit.count && existingLimit.count >= dailyLimit) {
        return { 
          success: false, 
          amount: 0, 
          newBalance: 0, 
          message: `Daily limit reached for ${missionType}. Max ${dailyLimit} per day.` 
        };
      }

      // Update or insert daily limit counter
      if (existingLimit) {
        await db.update(dailyMissionLimits)
          .set({ count: (existingLimit.count || 0) + 1, lastUpdated: new Date() })
          .where(eq(dailyMissionLimits.id, existingLimit.id));
      } else {
        await db.insert(dailyMissionLimits).values({
          userId,
          missionType,
          count: 1,
          date: today,
        });
      }
    }

    // Get current user balance
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { success: false, amount: 0, newBalance: 0, message: 'User not found' };
    }

    const currentBalance = user.rations || 0;
    const newBalance = currentBalance + mission.amount;
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
      amount: mission.amount,
      type: 'earn',
      category: mission.category,
      missionType,
      description: mission.description,
      referenceId,
      referenceType,
      balanceAfter: newBalance,
    });

    return {
      success: true,
      amount: mission.amount,
      newBalance,
      newRank: rankUp ? newRank : undefined,
      rankUp,
    };
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
  async getLeaderboard(limit: number = 10): Promise<Array<{
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
  ): Promise<{ awarded: boolean; missionType?: MissionType; amount?: number }> {
    if (streakType === 'study') {
      if (currentStreak === 7) {
        const result = await this.awardRations(userId, 'study_streak_7');
        return { awarded: result.success, missionType: 'study_streak_7', amount: result.amount };
      }
      if (currentStreak === 30) {
        const result = await this.awardRations(userId, 'study_streak_30');
        return { awarded: result.success, missionType: 'study_streak_30', amount: result.amount };
      }
    }
    
    if (streakType === 'devotional') {
      if (currentStreak === 7) {
        const result = await this.awardRations(userId, 'devotional_streak_7');
        return { awarded: result.success, missionType: 'devotional_streak_7', amount: result.amount };
      }
      if (currentStreak === 30) {
        const result = await this.awardRations(userId, 'devotional_streak_30');
        return { awarded: result.success, missionType: 'devotional_streak_30', amount: result.amount };
      }
    }

    return { awarded: false };
  }
}

export const rationsService = new RationsService();
