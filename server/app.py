import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
APP_ID = os.getenv("MATHPIX_APP_ID", "")
APP_KEY = os.getenv("MATHPIX_APP_KEY", "")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class Ink(BaseModel):
    image_base64: str

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
