export type StepOutcome = "pending" | "correct" | "incorrect" | "neutral";


export interface Step {
  id: string;
  text: string;
  outcome: StepOutcome;
  feedback?: string;
}


export interface Problem {
  id: string;
  question: string;
  canonicalAnswer: string; // string for simplicity
  // Optional metadata hooks for later (skill, difficulty, etc.)
  skill?: string[];
  difficulty?: "easy" | "medium" | "hard";
}
