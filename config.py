
# -------- Config for OrcaMath enrichment pipeline ----------
from __future__ import annotations
import os

# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SKILL_MODEL = os.getenv("SKILL_MODEL", "gpt-4.1-mini")
DIFF_MODEL  = os.getenv("DIFF_MODEL",  "gpt-4.1-mini")

# Concurrency (tune as you see fit; very high tiers can go higher)
MAX_WORKERS_SKILL = int(os.getenv("MAX_WORKERS_SKILL", "128"))
MAX_WORKERS_DIFF  = int(os.getenv("MAX_WORKERS_DIFF", "128"))

# Paths
DATA_DIR = os.getenv("DATA_DIR", "./data")
RAW_ORCA_PATH = os.path.join(DATA_DIR, "orca_math_word_problems_200k.jsonl")
TAGGED_PATH   = os.path.join(DATA_DIR, "tagged.jsonl")
COMPARE_CACHE = os.path.join(DATA_DIR, "compare_cache.jsonl")
FINAL_PATH    = os.path.join(DATA_DIR, "final_tagged_ranked.jsonl")

os.makedirs(DATA_DIR, exist_ok=True)

# Batch sizes
SKILL_BATCH_SIZE = int(os.getenv("SKILL_BATCH_SIZE", "50"))
DIFF_BATCH_SIZE  = int(os.getenv("DIFF_BATCH_SIZE", "200"))
RETRY_LIMIT = int(os.getenv("RETRY_LIMIT", "6"))
