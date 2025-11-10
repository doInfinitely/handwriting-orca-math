# OrcaMath Backend API

FastAPI server providing:
- Handwriting recognition (via Mathpix proxy)
- LLM-based math validation (via OpenAI GPT-4o)

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY=sk-...
export MATHPIX_APP_ID=your-id
export MATHPIX_APP_KEY=your-key

# Run server
uvicorn app:app --reload --host 0.0.0.0 --port 5056
```

## Deploy to Railway

1. Push code to GitHub
2. Create new project on Railway
3. Connect GitHub repo, set root directory to `server`
4. Add environment variables in Railway dashboard
5. Deploy automatically happens

Railway will use `Procfile` or `railway.json` configuration.

## Deploy to Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repo, set root directory to `server`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
6. Add environment variables in Render dashboard

## Environment Variables

Required:
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o
- `MATHPIX_APP_ID` - Mathpix application ID
- `MATHPIX_APP_KEY` - Mathpix application key

Optional:
- `PORT` - Server port (default: 8000, set by cloud providers)

## Endpoints

### `GET /health`
Health check endpoint
Returns: `{"status": "healthy", "service": "OrcaMath API", "version": "1.0.0"}`

### `POST /recognize`
Handwriting recognition endpoint
Body: `{"image_base64": "base64-encoded-image"}`
Returns: `{"text": "recognized LaTeX"}`

### `POST /validate`
Step validation endpoint
Body: `{"question": "...", "expectedAnswer": "...", "priorSteps": [...], "currentStep": "..."}`
Returns: `{"outcome": "correct|incorrect|neutral", "feedback": "..."}`

### `POST /validate/final`
Final answer check endpoint
Body: `{"question": "...", "expectedAnswer": "...", "allSteps": [...]}`
Returns: `{"isSolved": true|false, "feedback": "..."}`

## API Cost Estimates

- **OpenAI GPT-4o**: ~$0.01-0.03 per validation (depending on problem complexity)
- **Mathpix**: Check their pricing (usually per-image)

Budget accordingly based on expected usage.


