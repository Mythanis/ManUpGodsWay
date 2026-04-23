/**
 * Shared sidedness-classification helpers used by:
 *   - The admin requeue route (re-classify a single rejected exercise from the UI)
 *   - The batch script scripts/classify-exercise-sidedness.ts (classify all exercises)
 *
 * Keeping the prompt and parser in one place ensures the two code paths can never
 * silently diverge.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { exercises, exerciseSidednessReviews } from "../shared/schema";
import { eq } from "drizzle-orm";

export const MODEL = "claude-sonnet-4-20250514";
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 2000;

export const SYSTEM_PROMPT = `You are a biomechanics expert classifying gym exercises by sidedness.

For each exercise you must return ONLY a JSON object with these exact keys:
  "sidedness": one of "bilateral", "unilateral", or "alternating"
  "reasoning": a single sentence (≤20 words) explaining your choice
  "confidence": "high" if clear-cut, "low" if ambiguous

Definitions:
  bilateral   — both sides work simultaneously (squat, bench press, pull-up, push-up)
  unilateral  — one side completes its full set before switching (single-leg RDL,
                single-arm row, split squat — any exercise where you REPOSITION
                between sides)
  alternating — sides alternate within the same set (alternating dumbbell curl,
                alternating lunge, alternating leg raise — the word "alternating"
                or "alternate" in the name is a strong signal)

Return ONLY valid JSON. No markdown fences, no extra text.`;

export type SidednessValue = "bilateral" | "unilateral" | "alternating";

export interface ClaudeVerdict {
  sidedness: SidednessValue;
  reasoning: string;
  confidence: "high" | "low";
  rawResponse: string;
}

export async function withRetry<T>(fn: () => Promise<T>, label?: string): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw err;
      const isTransient =
        err?.status === 429 || err?.status >= 500 || err?.code === "ECONNRESET";
      if (!isTransient) throw err;
      const wait = RETRY_DELAY_MS * attempt;
      if (label) console.warn(`  [retry ${attempt}/${MAX_RETRIES}] ${label} — waiting ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

/**
 * Call Claude and parse the JSON verdict.
 * Does NOT apply rate-limiting — callers that need pacing (e.g. the batch
 * script) should acquire a token from their own rate-limiter before calling.
 */
export async function callClaude(
  client: Anthropic,
  ex: { name: string; instructions: string; bodyPart: string; equipment: string }
): Promise<ClaudeVerdict> {
  const userContent = [
    `Exercise name: ${ex.name}`,
    `Body part: ${ex.bodyPart}`,
    `Equipment: ${ex.equipment}`,
    `Instructions: ${ex.instructions}`,
  ].join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const rawResponse =
    response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("") || "";

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON found in Claude response");
    const parsed = JSON.parse(jsonMatch[0]);

    const valid: SidednessValue[] = ["bilateral", "unilateral", "alternating"];
    const sidedness: SidednessValue = valid.includes(parsed.sidedness)
      ? parsed.sidedness
      : "bilateral";
    const confidence: "high" | "low" =
      parsed.confidence === "low" ? "low" : "high";
    const reasoning =
      typeof parsed.reasoning === "string"
        ? parsed.reasoning.trim()
        : "No reason provided.";

    return { sidedness, reasoning, confidence, rawResponse };
  } catch {
    return {
      sidedness: "bilateral",
      reasoning: "Parse error; defaulted to bilateral.",
      confidence: "low",
      rawResponse,
    };
  }
}

/**
 * Re-classify a single exercise by its review row ID.
 * Fetches the exercise from DB, calls Claude, and updates the review row with
 * the fresh verdict while resetting status to 'pending'.
 *
 * Throws if the exercise row is missing (review existence should be checked by
 * the caller before calling this to distinguish 404 from 500).
 */
export async function reclassifyExerciseSidedness(
  reviewId: number
): Promise<{ exerciseName: string; verdict: ClaudeVerdict }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const [review] = await db
    .select()
    .from(exerciseSidednessReviews)
    .where(eq(exerciseSidednessReviews.id, reviewId))
    .limit(1);
  if (!review) throw new Error(`Sidedness review #${reviewId} not found`);

  const [ex] = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      instructions: exercises.instructions,
      bodyPart: exercises.bodyPart,
      equipment: exercises.equipment,
    })
    .from(exercises)
    .where(eq(exercises.id, review.exerciseId))
    .limit(1);
  if (!ex) throw new Error(`Exercise #${review.exerciseId} not found`);

  const client = new Anthropic({ apiKey });
  const verdict = await withRetry(() => callClaude(client, ex));

  await db
    .update(exerciseSidednessReviews)
    .set({
      proposedSidedness: verdict.sidedness,
      reasoning: verdict.reasoning,
      confidence: verdict.confidence,
      rawModelResponse: verdict.rawResponse,
      status: "pending",
      approvedSidedness: null,
      reviewedAt: null,
      processedAt: new Date(),
    })
    .where(eq(exerciseSidednessReviews.id, reviewId));

  return { exerciseName: ex.name, verdict };
}
