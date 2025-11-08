import type { Step, Problem } from "./types";
import { validateStep, checkIfSolved } from "./llmValidator";

/**
 * LLM-based validation that works for any problem.
 * Uses an external LLM API to validate steps and check if problems are solved.
 */

/**
 * Check a single line in the context of all prior lines using LLM validation.
 */
export async function checkNewLine(
  problem: Problem,
  prior: Step[],
  newLine: string
): Promise<{
  outcome: Step["outcome"];
  feedback?: string;
}> {
  const result = await validateStep(problem, prior, newLine);
  return {
    outcome: result.outcome,
    feedback: result.feedback,
  };
}

/**
 * Check if the problem is solved based on all steps.
 */
export async function isSolved(steps: Step[], problem: Problem): Promise<boolean> {
  const result = await checkIfSolved(problem, steps);
  return result.isSolved;
}

/**
 * Final submission check with detailed feedback.
 */
export async function finalCheck(
  problem: Problem,
  steps: Step[]
): Promise<{
  correct: boolean;
  feedback: string;
}> {
  const result = await checkIfSolved(problem, steps);
  return {
    correct: result.isSolved,
    feedback: result.feedback,
  };
}
