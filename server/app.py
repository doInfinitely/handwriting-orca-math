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

Your job is to evaluate a single step in the student's solution process.

Given:
- The original problem question
- The expected final answer
- All prior steps the student has written
- The current step to validate

Determine if the current step is:
1. "correct" - mathematically sound and helpful toward the solution
2. "incorrect" - contains an error or wrong reasoning
3. "neutral" - not wrong but not particularly helpful

Respond in JSON format:
{
  "outcome": "correct" | "incorrect" | "neutral",
  "feedback": "Brief encouraging feedback (1-2 sentences)"
}

Be encouraging and specific. If correct, praise what they did. If incorrect, gently point out the error. If neutral, guide them toward a useful next step."""

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

@app.post("/validate", response_model=ValidationResponse)
async def validate_step(req: ValidationRequest):
    """Validate a single math step."""
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
            model="gpt-4o-mini",
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
            model="gpt-4o-mini",
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
