import { Asset } from 'expo-asset';

export interface ProblemData {
  id: number;
  question: string;
  answer: string;
  skill_tags: string[];
}

// Use a singleton pattern to ensure data persists across hot reloads
let cachedProblems: ProblemData[] | null = null;
let cachedTags: string[] | null = null;
let loadingPromise: Promise<ProblemData[]> | null = null;
let hasInitialized = false;

/**
 * Check if problems are already loaded in cache
 */
export function areProblemsLoaded(): boolean {
  return cachedProblems !== null && cachedProblems.length > 0;
}

/**
 * Get cached problems immediately (synchronous)
 */
export function getCachedProblems(): ProblemData[] {
  return cachedProblems || [];
}

/**
 * Get cached tags immediately (synchronous)
 */
export function getCachedTags(): string[] {
  return cachedTags || [];
}

/**
 * Load problems from the JSONL file
 * For large files, this loads everything into memory once and caches it
 */
export async function loadProblems(): Promise<ProblemData[]> {
  // Return cached if available
  if (cachedProblems && hasInitialized) {
    console.log('✅ Returning cached problems');
    return cachedProblems;
  }

  // If already loading, return the same promise to prevent duplicate loads
  if (loadingPromise) {
    console.log('⏳ Load already in progress, waiting...');
    return loadingPromise;
  }

  console.log('📚 Loading problems from tagged.jsonl...');
  hasInitialized = true;
  
  loadingPromise = (async () => {
    try {
    // Load the asset and get its URI
    const asset = Asset.fromModule(require('../data/tagged.jsonl'));
    await asset.downloadAsync();
    
    if (!asset.localUri) {
      throw new Error('Could not load problems file');
    }

    // Fetch the file content using fetch API
    const response = await fetch(asset.localUri);
    const fileContent = await response.text();
    
    // Parse JSONL (each line is a separate JSON object)
    const lines = fileContent.trim().split('\n');
    cachedProblems = lines.map(line => JSON.parse(line));
    
    console.log(`✅ Loaded ${cachedProblems.length} problems`);
    return cachedProblems;
  } catch (error) {
    console.error('❌ Error loading problems:', error);
    // Cache empty array to prevent retry loops
    cachedProblems = [];
    return [];
  } finally {
    loadingPromise = null;
  }
  })();

  return loadingPromise;
}

/**
 * Get all unique tags from problems
 */
export async function getAllTags(): Promise<string[]> {
  if (cachedTags) {
    return cachedTags;
  }

  const problems = await loadProblems();
  const tagsSet = new Set<string>();
  
  problems.forEach(problem => {
    problem.skill_tags.forEach(tag => tagsSet.add(tag));
  });
  
  cachedTags = Array.from(tagsSet).sort();
  return cachedTags;
}

/**
 * Filter problems by selected tags
 * If no tags selected, returns all problems
 */
export function filterProblemsByTags(
  problems: ProblemData[],
  selectedTags: string[]
): ProblemData[] {
  if (selectedTags.length === 0) {
    return problems;
  }
  
  return problems.filter(problem =>
    selectedTags.every(tag => problem.skill_tags.includes(tag))
  );
}

/**
 * Paginate problems
 */
export function paginateProblems(
  problems: ProblemData[],
  page: number,
  pageSize: number
): ProblemData[] {
  const start = page * pageSize;
  const end = start + pageSize;
  return problems.slice(start, end);
}


