/**
 * Combined exercise reclassification using Claude Opus.
 *
 * One API call per exercise returns:
 *   - sidedness (bilateral / unilateral / alternating)
 *   - sidedness_confidence (high / medium / low)
 *   - sidedness_reasoning (one sentence)
 *   - instructions_match (bool — do current instructions match the video?)
 *   - corrected_instructions (replacement text, or null when instructions_match = true)
 *   - instructions_confidence (high / medium / low)
 *
 * Used by:
 *   scripts/reclassify-exercises.ts  — batch CLI pass over the whole library
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

export const OPUS_MODEL = "claude-opus-4-5";
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 3000;

export type ConfidenceValue = "high" | "medium" | "low";
export type SidednessValue = "bilateral" | "unilateral" | "alternating";

export interface OpusVerdict {
  sidedness: SidednessValue;
  sidednessConfidence: ConfidenceValue;
  sidednessReasoning: string;
  instructionsMatch: boolean;
  correctedInstructions: string | null;
  instructionsConfidence: ConfidenceValue;
  rawResponse: string;
}

export const SYSTEM_PROMPT = `You are an elite fitness coach and biomechanics expert reviewing gym exercise demonstrations.

You will be shown a series of frames extracted evenly across the FULL duration of a short exercise demo video, along with the current written instructions for that exercise.

Respond with ONLY a single JSON object (no markdown, no extra text) with these exact keys:

{
  "sidedness": "bilateral" | "unilateral" | "alternating",
  "sidedness_confidence": "high" | "medium" | "low",
  "sidedness_reasoning": "<one sentence ≤ 20 words>",
  "instructions_match": true | false,
  "corrected_instructions": "<2-4 concise numbered steps>" | null,
  "instructions_confidence": "high" | "medium" | "low"
}

SIDEDNESS DEFINITIONS:
  bilateral   — both sides work simultaneously (e.g. squat, bench press, pull-up, push-up, plank)
  unilateral  — one side completes ALL reps before switching sides (e.g. single-leg RDL, single-arm row,
                any exercise where the athlete must REPOSITION between sides)
  alternating — sides alternate within the same set (e.g. alternating lunge, alternating dumbbell curl)

CONFIDENCE LEVELS:
  high   — you are very certain
  medium — you lean toward the verdict but the video or name leaves some ambiguity
  low    — genuinely ambiguous; admin must decide

INSTRUCTION RULES:
  • If the instructions accurately describe what you see across the full video, set instructions_match = true
    and corrected_instructions = null.
  • If the instructions are wrong, incomplete, or misleading, set instructions_match = false and provide
    corrected_instructions based ONLY on what you observe in the frames.
  • Keep corrected_instructions to 2-4 numbered steps. Be specific about form cues you can actually see.

Return ONLY valid JSON. No markdown fences. No extra commentary.`;

function parseVerdict(raw: string): OpusVerdict {
  const VALID_SIDEDNESS: SidednessValue[] = ["bilateral", "unilateral", "alternating"];
  const VALID_CONF: ConfidenceValue[] = ["high", "medium", "low"];

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON found");
    const p = JSON.parse(match[0]);

    const sidedness: SidednessValue = VALID_SIDEDNESS.includes(p.sidedness)
      ? p.sidedness
      : "bilateral";

    const sidednessConfidence: ConfidenceValue = VALID_CONF.includes(p.sidedness_confidence)
      ? p.sidedness_confidence
      : "low";

    const sidednessReasoning =
      typeof p.sidedness_reasoning === "string"
        ? p.sidedness_reasoning.trim()
        : "No reasoning provided.";

    const instructionsMatch = p.instructions_match === true;

    const correctedInstructions =
      instructionsMatch || typeof p.corrected_instructions !== "string"
        ? null
        : p.corrected_instructions.trim() || null;

    const instructionsConfidence: ConfidenceValue = VALID_CONF.includes(
      p.instructions_confidence
    )
      ? p.instructions_confidence
      : "low";

    return {
      sidedness,
      sidednessConfidence,
      sidednessReasoning,
      instructionsMatch,
      correctedInstructions,
      instructionsConfidence,
      rawResponse: raw,
    };
  } catch {
    return {
      sidedness: "bilateral",
      sidednessConfidence: "low",
      sidednessReasoning: "Parse error — defaulted to bilateral.",
      instructionsMatch: false,
      correctedInstructions: null,
      instructionsConfidence: "low",
      rawResponse: raw,
    };
  }
}

/**
 * Send one Opus call with up to 12 video frames + exercise metadata.
 * Does NOT handle rate-limiting — callers should acquire a token first.
 */
export async function callOpusCombined(
  client: Anthropic,
  exercise: {
    name: string;
    instructions: string;
    bodyPart: string;
    equipment: string;
  },
  framePaths: string[]
): Promise<OpusVerdict> {
  const imageBlocks: Anthropic.ImageBlockParam[] = framePaths.map((fp) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: fs.readFileSync(fp).toString("base64"),
    },
  }));

  const textBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: [
      `Exercise name: ${exercise.name}`,
      `Body part: ${exercise.bodyPart}`,
      `Equipment: ${exercise.equipment}`,
      `Current instructions:\n${exercise.instructions}`,
      `\nFrames above are extracted evenly across the full video (${framePaths.length} frames total).`,
    ].join("\n"),
  };

  const response = await client.messages.create({
    model: OPUS_MODEL,
    max_tokens: 768,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, textBlock],
      },
    ],
  });

  const raw =
    response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("") || "";

  return parseVerdict(raw);
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
