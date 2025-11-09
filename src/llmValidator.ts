import type { Step, Problem } from "./types";
import Constants from 'expo-constants';

const LLM_API_URL = Constants.expoConfig?.extra?.expoPublic?.LLM_API_URL || "http://10.10.0.202:5056/validate";

export interface ValidationRequest {
  question: string;
  expectedAnswer: string;
  priorSteps: string[];
  currentStep: string;
}

export interface ValidationResponse {
  outcome: "correct" | "incorrect" | "neutral";
  feedback: string;
}

export interface FinalCheckRequest {
  question: string;
  expectedAnswer: string;
  allSteps: string[];
}

export interface FinalCheckResponse {
  isSolved: boolean;
  feedback: string;
}

/**
 * Validates a single step using an LLM
 */
export async function validateStep(
  problem: Problem,
  priorSteps: Step[],
  currentStep: string
): Promise<ValidationResponse> {
  const request: ValidationRequest = {
    question: problem.question,
    expectedAnswer: problem.canonicalAnswer,
    priorSteps: priorSteps.map(s => s.text),
    currentStep: currentStep,
  };

  console.log("📤 Sending validation request to:", LLM_API_URL);
  console.log("📤 Request payload:", request);

  try {
    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Validation API error:", response.status, errorText);
      throw new Error(`Validation failed: ${response.status}`);
    }

    const result: ValidationResponse = await response.json();
    console.log("✅ Validation response:", result);
    
    return result;
  } catch (error) {
    console.error("❌ Validation error:", error);
    // Fallback to neutral if API is unavailable
    return {
      outcome: "neutral",
      feedback: "Unable to validate step (API unavailable). Continue working.",
    };
  }
}

/**
 * Checks if the problem is fully solved using an LLM
 */
export async function checkIfSolved(
  problem: Problem,
  steps: Step[]
): Promise<FinalCheckResponse> {
  const request: FinalCheckRequest = {
    question: problem.question,
    expectedAnswer: problem.canonicalAnswer,
    allSteps: steps.map(s => s.text),
  };

  console.log("📤 Sending final check request:", request);

  try {
    const response = await fetch(`${LLM_API_URL}/final`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Final check API error:", response.status, errorText);
      throw new Error(`Final check failed: ${response.status}`);
    }

    const result: FinalCheckResponse = await response.json();
    console.log("✅ Final check response:", result);
    
    return result;
  } catch (error) {
    console.error("❌ Final check error:", error);
    // Fallback: check if canonical answer appears in any step
    const hasAnswer = steps.some(s => 
      s.text.toLowerCase().includes(problem.canonicalAnswer.toLowerCase())
    );
    return {
      isSolved: hasAnswer,
      feedback: hasAnswer 
        ? "Solution appears correct (fallback check)."
        : "Solution incomplete or incorrect (fallback check).",
    };
  }
}

