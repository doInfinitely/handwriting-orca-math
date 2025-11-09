# Problems Browser

This app now includes a full-featured problems browser with 200,000+ math questions!

## Features

### 🏠 Problems List Screen
- Browse all 200,000+ problems with pagination (20 per page)
- Filter by skill tags (division, multiplication, fractions, etc.)
- Multi-tag filtering (combine multiple tags)
- Search problems by question text or tags
- See problem metadata (ID, tags, question preview)
- Tap any problem to solve it

### ✏️ Problem Solve Screen
- Full handwriting recognition with Mathpix
- LLM-based step validation
- LaTeX rendering for math expressions
- Step-by-step solution tracking
- Real-time feedback on each step
- Submit final solution for checking

## Data Structure

Each problem in `data/tagged.jsonl` contains:
- `id`: Unique problem identifier
- `question`: The problem text
- `answer`: Full solution explanation
- `skill_tags`: Array of skill tags (e.g., ["division", "rounding"])

## Navigation Flow

```
ProblemsListScreen (Start)
  ↓
  Select filters/tags
  ↓
  Browse paginated results
  ↓
  Tap a problem
  ↓
ProblemSolveScreen
  ↓
  Solve with handwriting
  ↓
  Get validation & feedback
  ↓
  Back to list or submit
```

## Performance Notes

### Large File Handling
The 200MB `tagged.jsonl` file is loaded once on app start and cached in memory:
- First load: ~2-5 seconds
- Subsequent access: instant (cached)
- Memory usage: ~200-300MB

### Pagination
- 20 problems per page for smooth scrolling
- Filtered results update instantly
- Page navigation with prev/next buttons

### Tag Filtering
- All unique tags extracted on first load
- Multiple tag selection (AND logic)
- Filtered results show problem count

## Building

Since the data file is large, you need to rebuild the app after changes:

```bash
# Rebuild for dev client
npx expo run:ios --device

# Or use EAS build
eas build --profile development --platform ios
```

## Customization

### Adjusting Page Size
In `ProblemsListScreen.tsx`:
```typescript
const PAGE_SIZE = 20; // Change to 10, 50, etc.
```

### Answer Extraction
The `extractAnswer()` function in `ProblemsListScreen.tsx` extracts the final answer from the solution text. Adjust the regex if needed:
```typescript
const extractAnswer = (answerText: string): string => {
  // Current: finds last number
  const matches = answerText.match(/(\d+\.?\d*)/g);
  return matches ? matches[matches.length - 1] : "unknown";
};
```

### Adding More Tags Display
Currently shows top 20 tags. To show more:
```typescript
{allTags.slice(0, 50).map(tag => ...)} // Show 50 instead of 20
```

## Future Enhancements

- [ ] Add difficulty filtering (once computed)
- [ ] Problem bookmarking/favorites
- [ ] Progress tracking per problem
- [ ] Search history
- [ ] Recently solved problems
- [ ] Tag popularity sorting
- [ ] Problem recommendations


