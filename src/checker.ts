import type { Step, Problem } from "./types";


/**
 * Tiny built-in checker for THIS SPECIFIC problem only.
 *
 * Problem text:
 * "A number divided by 10 is 6. Yoongi got the result by subtracting 15 from a certain number. What is the result he got?"
 * Canonical thinking:
 * - Let x be the number such that x/10 = 6 → x = 60
 * - Result = x - 15 = 45 (answer)
 */


const EXPECTED_FINAL = "45";


// very small helpers
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();


/**
 * Check a *single* line in the context of all prior lines.
 * We’re generous: we mark lines as "correct" if they:
 * - state x/10 = 6, or
 * - derive x = 60 from that, or
 * - compute 60 - 15 = 45 (or state the final answer 45)
 * Otherwise: "neutral" unless clearly wrong arithmetic.
 */
export function checkNewLine(problem: Problem, prior: Step[], newLine: string): {
  outcome: Step["outcome"];
  feedback?: string;
} {
  const t = normalize(newLine).toLowerCase();


  // simple correctness patterns
  const eq60 = /\bx\s*=\s*60\b/;
  const divEq = /\bx\s*\/?\s*10\s*=\s*6\b|\bx\s*divided by\s*10\s*is\s*6\b/;
  const final45 = /(^|\b)(45)(\b|$)/;
  const compute = /(60\s*-\s*15\s*=\s*45)|(result\s*=\s*45)/;


  // clearly wrong arithmetic like stating 60-15 = != 45
  const wrongCompute = /(60\s*-\s*15\s*=\s*(?!45)\d+)/;


  if (wrongCompute.test(t)) {
    return { outcome: "incorrect", feedback: "Check the subtraction: 60 − 15 should be 45." };
  }


  if (divEq.test(t)) {
    return { outcome: "correct", feedback: "Good start: you defined the equation x/10 = 6." };
  }


  if (eq60.test(t)) {
    return { outcome: "correct", feedback: "Nice—solved for x correctly (x = 60)." };
  }


  if (compute.test(t) || final45.test(t)) {
    return { outcome: "correct", feedback: "That’s the result Yoongi got: 45." };
  }


  // neutral: not wrong but not obviously helpful
  return { outcome: "neutral", feedback: "Try writing either x/10 = 6, then x = 60, then 60 − 15 = 45." };
}


export function isSolved(steps: Step[], problem: Problem): boolean {
  // solved if any line states 45 explicitly or compute matches
  const finalRegex = /(60\s*-\s*15\s*=\s*45)|(^|\b)(45)(\b|$)/;
  return steps.some((s) => finalRegex.test(normalize(s.text)));
}


export function finalCheck(problem: Problem, steps: Step[]): {
  correct: boolean;
  feedback: string;
} {
  const ok = isSolved(steps, problem);
  return ok
  ? { correct: true, feedback: "✅ Correct. Final result: 45." }
  : { correct: false, feedback: "Not quite yet. Aim to compute 60 − 15 and state the result." };
}
