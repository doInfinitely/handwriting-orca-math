export type StepOutcome = "pending" | "correct" | "incorrect" | "neutral";


export interface Step {
  id: string;
  text: string;
  outcome: StepOutcome;
  feedback?: string;
  imageBase64?: string;
}


export interface Problem {
  id: string | number;
  question: string;
  canonicalAnswer: string; // string for simplicity
  // Optional metadata hooks for later (skill, difficulty, etc.)
  skill?: string[];
  skill_tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
}

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  ProblemsList: undefined;
  ProblemSolve: { problem: Problem };
  Profile: undefined;
};
