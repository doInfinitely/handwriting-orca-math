# LLM Validation Server

This server provides LLM-based validation for math problem solving steps.

## Features

- **Step Validation**: Validates individual steps as correct, incorrect, or neutral
- **Final Check**: Determines if a problem is fully solved
- **Context-Aware**: Uses all prior steps to validate the current step
- **Customizable**: Works with any LLM (OpenAI, Anthropic, local models, etc.)

## Setup

### 1. Install Dependencies

```bash
cd server
pip install -r requirements-validator.txt
```

### 2. Set Your OpenAI API Key

```bash
export OPENAI_API_KEY="your-api-key-here"
```

### 3. Run the Server

```bash
python llm-validator.py
```

The server will start on `http://0.0.0.0:5057`

### 4. Update App Configuration

The app is already configured to use `http://10.10.0.202:5057/validate`

Make sure to:
- Update the IP address to your local machine's IP
- Or run on localhost if testing on simulator

## API Endpoints

### POST /validate

Validates a single step.

**Request:**
```json
{
  "question": "A number divided by 10 is 6...",
  "expectedAnswer": "45",
  "priorSteps": ["x/10 = 6", "x = 60"],
  "currentStep": "60 - 15 = 45"
}
```

**Response:**
```json
{
  "outcome": "correct",
  "feedback": "Great! You correctly computed the final result."
}
```

### POST /validate/final

Checks if the problem is fully solved.

**Request:**
```json
{
  "question": "A number divided by 10 is 6...",
  "expectedAnswer": "45",
  "allSteps": ["x/10 = 6", "x = 60", "60 - 15 = 45"]
}
```

**Response:**
```json
{
  "isSolved": true,
  "feedback": "Excellent work! You correctly solved the problem and arrived at 45."
}
```

## Using Different LLMs

### OpenAI (default)
Already configured. Just set `OPENAI_API_KEY`.

### Anthropic Claude
```python
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Update the API calls to use claude-3-sonnet, etc.
```

### Local LLMs (Ollama, LM Studio, etc.)
```python
# For local models running on localhost:11434
import requests

response = requests.post(
    "http://localhost:11434/api/chat",
    json={
        "model": "llama3",
        "messages": messages,
    }
)
```

## Testing

Test the validation endpoint:

```bash
curl -X POST http://localhost:5057/validate \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is 2 + 2?",
    "expectedAnswer": "4",
    "priorSteps": [],
    "currentStep": "2 + 2 = 4"
  }'
```

Expected response:
```json
{
  "outcome": "correct",
  "feedback": "Perfect! You correctly identified that 2 + 2 equals 4."
}
```

## Prompts

The system uses two main prompts:

1. **VALIDATION_SYSTEM_PROMPT**: Guides the LLM to evaluate single steps
2. **FINAL_CHECK_SYSTEM_PROMPT**: Guides the LLM to check if problem is solved

You can customize these prompts in `llm-validator.py` to:
- Change the tone (more strict, more encouraging, etc.)
- Add subject-specific guidance (algebra, geometry, etc.)
- Require specific formats or explanations

## Performance

- **Latency**: ~500ms-2s per validation (depends on LLM)
- **Cost**: ~$0.001-0.01 per validation with GPT-4o-mini
- **Accuracy**: Very high with GPT-4 models

## Fallback Behavior

If the LLM API is unavailable, the app will:
- Mark steps as "neutral" and let the user continue
- Use a simple pattern match for final answer checking
- Display a message about validation being unavailable


