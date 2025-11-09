import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
APP_ID = os.getenv("MATHPIX_APP_ID", "")
APP_KEY = os.getenv("MATHPIX_APP_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Initialize OpenAI client
def get_openai_client():
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not set")
    return OpenAI(api_key=OPENAI_API_KEY)

# Pydantic models for mathpix
class Ink(BaseModel):
    image_base64: str

# Pydantic models for validation
class ValidationRequest(BaseModel):
    question: str
    expectedAnswer: str
    priorSteps: list[str] = []
    currentStep: str

class ValidationResponse(BaseModel):
    outcome: str  # "correct" | "incorrect" | "neutral"
    feedback: str

class FinalCheckRequest(BaseModel):
    question: str
    expectedAnswer: str
    allSteps: list[str]

class FinalCheckResponse(BaseModel):
    isSolved: bool
    feedback: str

VALIDATION_SYSTEM_PROMPT = """You are an expert math tutor validating student work step-by-step.

Your job: Evaluate if the CURRENT STEP is mathematically correct.

CRITICAL RULES:
1. **Verify the arithmetic/algebra** - Check if the math in this step is correct
2. **The step does NOT need to equal the final answer** - it's just one step in a multi-step solution
3. **Use proper order of operations** - Evaluate expressions correctly (PEMDAS/BODMAS)
4. **Examples of CORRECT steps**:
   - "458.64 / 14 = 32.76" (division is correct)
   - "32.76 - 1 * 17 = 15.76" (multiplication first: 1*17=17, then 32.76-17=15.76 ✓)
   - "⌊32.76 / 17⌋ = 1" (floor division: 32.76÷17=1.927..., floor = 1 ✓)
5. **Accept various notations**:
   - "/" and "÷" for division
   - "*" and "×" for multiplication
   - "⌊x⌋" for floor function
   - "mod" for modulo
6. **Only mark "incorrect" if there's an actual math error** - be absolutely certain!

Evaluation criteria:
- "correct" → The math is valid and helps solve the problem
- "incorrect" → There's a calculation error (verify carefully!)
- "neutral" → Correct math but doesn't advance the solution

Respond in JSON:
{
  "outcome": "correct" | "incorrect" | "neutral",
  "feedback": "Brief encouragement (1-2 sentences)"
}

Be encouraging and mathematically precise!"""

FINAL_CHECK_SYSTEM_PROMPT = """You are an expert math tutor checking if a student has fully solved a problem.

Given:
- The original problem question
- The expected final answer
- All steps the student has written

Determine if the problem is fully solved (they arrived at the correct answer through valid reasoning).

Respond in JSON format:
{
  "isSolved": true | false,
  "feedback": "Congratulatory message if solved, or guidance on what's missing if not"
}"""

@app.post("/recognize")
async def recognize(ink: Ink):
    src = f"data:image/png;base64,{ink.image_base64}"
    payload = {"src": src, "formats": ["text"], "data_options": {"include_asciimath": True}}
    headers = {"Content-Type": "application/json", "app_id": APP_ID, "app_key": APP_KEY}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post("https://api.mathpix.com/v3/text", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    return {"text": (data.get("text") or "").strip(), "raw": data}

def check_arithmetic(step: str) -> tuple[bool | None, str | None]:
    """Check if a step contains simple arithmetic that we can verify directly."""
    import re
    
    # Remove LaTeX delimiters
    step_clean = step.replace('\\(', '').replace('\\)', '').replace('$', '').strip()
    
    # Match patterns like "X / Y = Z" or "X + Y = Z" etc.
    patterns = [
        (r'(\d+\.?\d*)\s*[/÷]\s*(\d+\.?\d*)\s*=\s*(\d+\.?\d*)', '/', lambda a, b: a / b if b != 0 else None),
        (r'(\d+\.?\d*)\s*\*\s*(\d+\.?\d*)\s*=\s*(\d+\.?\d*)', '*', lambda a, b: a * b),
        (r'(\d+\.?\d*)\s*\+\s*(\d+\.?\d*)\s*=\s*(\d+\.?\d*)', '+', lambda a, b: a + b),
        (r'(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*=\s*(\d+\.?\d*)', '-', lambda a, b: a - b),
    ]
    
    for pattern, op_symbol, operation in patterns:
        match = re.search(pattern, step_clean)
        if match:
            try:
                left = float(match.group(1))
                right = float(match.group(2))
                result = float(match.group(3))
                expected = operation(left, right)
                
                if expected is None:
                    continue
                
                # Allow small floating point errors
                if abs(expected - result) < 0.01:
                    return True, f"Perfect! {left} {op_symbol} {right} = {result} is absolutely correct!"
                else:
                    return False, f"Check your calculation: {left} {op_symbol} {right} should equal {expected:.2f}, not {result}"
            except (ValueError, ZeroDivisionError):
                pass
    
    return None, None  # Can't verify automatically

@app.post("/validate", response_model=ValidationResponse)
async def validate_step(req: ValidationRequest):
    """Validate a single math step using GPT-4o."""
    prior_steps_text = "\n".join(f"{i+1}. {step}" for i, step in enumerate(req.priorSteps))
    
    user_message = f"""Problem: {req.question}

Expected Answer: {req.expectedAnswer}

Prior Steps:
{prior_steps_text if prior_steps_text else "(None yet)"}

Current Step to Validate:
{req.currentStep}

Evaluate this step and respond with JSON."""

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": VALIDATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        
        import json
        result = json.loads(response.choices[0].message.content)
        return ValidationResponse(**result)
    
    except Exception as e:
        print(f"Validation error: {e}")
        return ValidationResponse(
            outcome="neutral",
            feedback="Unable to validate at this time. Continue working."
        )

@app.post("/validate/final", response_model=FinalCheckResponse)
async def check_final(req: FinalCheckRequest):
    """Check if the problem is fully solved."""
    steps_text = "\n".join(f"{i+1}. {step}" for i, step in enumerate(req.allSteps))
    
    user_message = f"""Problem: {req.question}

Expected Answer: {req.expectedAnswer}

Student's Work:
{steps_text if steps_text else "(No steps provided)"}

Has the student fully solved this problem? Respond with JSON."""

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": FINAL_CHECK_SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        
        import json
        result = json.loads(response.choices[0].message.content)
        return FinalCheckResponse(**result)
    
    except Exception as e:
        print(f"Final check error: {e}")
        return FinalCheckResponse(
            isSolved=False,
            feedback="Unable to check solution at this time."
        )
