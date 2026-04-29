import { db } from './db';
import { storage } from './storage';
import { mentions, users } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

export type MentionSourceType =
  | 'hurdle_wall_post'
  | 'hurdle_wall_reply'
  | 'discussion'
  | 'discussion_reply'
  | 'message'
  | 'war_group_post'
  | 'war_group_reply'
  | 'accountability_request';

const MENTION_REGEX = /@\[([^\]]+)\]\(mention:([^)]+)\)/g;

export interface ParsedMention {
  display: string;
  token: string;
}

export function parseMentions(text: string | null | undefined): ParsedMention[] {
  if (!text) return [];
  const out: ParsedMention[] = [];
  const matches = Array.from(text.matchAll(MENTION_REGEX));
  for (const m of matches) {
    out.push({ display: m[1], token: m[2] });
  }
  return out;
}

interface FanOutContext {
  text: string | null | undefined;
  authorId: string;
  sourceType: MentionSourceType;
  sourceId: string;
  linkUrl: string;
  surfaceLabel: string;
  isAuthorOwner?: boolean;
  alwaysNotify?: boolean;
}

async function getExistingMentionedIds(sourceType: MentionSourceType, sourceId: string): Promise<Set<string>> {
  const rows = await db.select({ uid: mentions.mentionedUserId })
    .from(mentions)
    .where(and(eq(mentions.sourceType, sourceType), eq(mentions.sourceId, sourceId)));
  return new Set(rows.map(r => r.uid));
}

export async function resolveMentionTargets(
  text: string | null | undefined,
  authorId: string,
  isAuthorOwner: boolean,
): Promise<Set<string>> {
  const parsed = parseMentions(text);
  if (parsed.length === 0) return new Set();

  const targets = new Set<string>();
  let needBrothers = false;
  let needEveryone = false;
  const explicitIds: string[] = [];

  for (const p of parsed) {
    if (p.token === 'brothers') needBrothers = true;
    else if (p.token === 'everyone') {
      if (isAuthorOwner) needEveryone = true;
      // silently dropped for non-owners
    } else if (p.token && p.token.length > 0) {
      explicitIds.push(p.token);
    }
  }

  if (needEveryone) {
    const allUsers = await db.select({ id: users.id }).from(users);
    for (const u of allUsers) targets.add(u.id);
  } else {
    if (needBrothers) {
      const brothers = await storage.getUserBrothers(authorId);
      for (const b of brothers) targets.add(b.id);
    }
    for (const id of explicitIds) targets.add(id);
  }

  // Author never mentions themselves
  targets.delete(authorId);
  return targets;
}

/**
 * Extracts mentions from text, persists tracking rows, and creates
 * notifications for newly-mentioned users (relative to whatever was already
 * tracked in the mentions table for this source).
 *
 * - On create: nothing is in the mentions table, so all targets get notified.
 * - On edit: only newly-added mentions get notified.
 * - @brothers: tags all confirmed brothers of the author.
 * - @everyone: only honored if the author is an owner; silently dropped otherwise.
 * - alwaysNotify: bypass the mention preference (used for explicit @-mentions
 *   in war groups for users who aren't members yet).
 */
export async function extractMentionsAndFanOut(ctx: FanOutContext): Promise<void> {
  try {
    const isAuthorOwner = ctx.isAuthorOwner ?? false;
    const targets = await resolveMentionTargets(ctx.text, ctx.authorId, isAuthorOwner);

    const existing = await getExistingMentionedIds(ctx.sourceType, ctx.sourceId);
    const newlyMentioned: string[] = [];
    const allCurrent: string[] = [];

    for (const uid of Array.from(targets)) {
      allCurrent.push(uid);
      if (!existing.has(uid)) newlyMentioned.push(uid);
    }

    // Persist mention rows for any new ones (we keep historical rows even if
    // someone is removed in an edit — we just don't re-notify them).
    if (newlyMentioned.length > 0) {
      await db.insert(mentions).values(
        newlyMentioned.map(uid => ({
          sourceType: ctx.sourceType,
          sourceId: ctx.sourceId,
          mentionedUserId: uid,
          authorId: ctx.authorId,
        }))
      ).onConflictDoNothing?.();
    }

    if (newlyMentioned.length === 0) return;

    const author = await storage.getUser(ctx.authorId);
    const authorName = author
      ? `${author.firstName ?? ''} ${author.lastName ?? ''}`.trim() || 'A brother'
      : 'A brother';

    const title = `${authorName} mentioned you`;
    const message = `You were tagged in ${ctx.surfaceLabel}.`;

    await Promise.allSettled(newlyMentioned.map(async (uid) => {
      if (ctx.alwaysNotify) {
        // Bypass preference check (e.g., non-members tagged in war group posts)
        await storage.createNotification({
          userId: uid,
          type: 'mention',
          title,
          message,
          relatedId: ctx.sourceId,
          linkUrl: ctx.linkUrl,
        }, { pushUrl: ctx.linkUrl });
      } else {
        await storage.createNotificationWithPreferences({
          userId: uid,
          type: 'mention',
          title,
          message,
          relatedId: ctx.sourceId,
          linkUrl: ctx.linkUrl,
        }, { url: ctx.linkUrl });
      }
    }));
  } catch (error) {
    console.error('[Mentions] Fan-out error:', error);
  }
}
