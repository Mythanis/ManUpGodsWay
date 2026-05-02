/**
 * Strips real user IDs from mention tokens before content is sent to clients.
 *
 * Mention markup stored in the DB is:  @[Display Name](mention:userId)
 * The userId can be a numeric Replit ID or a UUID — both are sensitive.
 *
 * This function replaces the token with a name-based slug so the user ID is
 * never exposed in API responses:
 *   @[Clint Lowery](mention:56749294)  →  @[Clint Lowery](mention:clintlowery)
 *
 * The MentionText component only uses the display name (capture group 1) for
 * rendering, so the slug change is invisible to the end user. IDs are kept
 * intact in the DB for server-side mention fan-out processing.
 */
export function maskMentionIds(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  return text.replace(
    /@\[([^\]]+)\]\(mention:[^)]+\)/g,
    (_, display) => `@[${display}](mention:${display.toLowerCase().replace(/\s+/g, '')})`
  );
}
