
from __future__ import annotations
import os, time, json, random, itertools, hashlib, threading
from typing import Iterable, Dict, Any, Tuple, List
from dataclasses import dataclass
from config import RETRY_LIMIT
from openai import OpenAI

_client_singleton = None
_client_lock = threading.Lock()

def get_client() -> OpenAI:
    global _client_singleton
    if _client_singleton is None:
        with _client_lock:
            if _client_singleton is None:
                _client_singleton = OpenAI()
    return _client_singleton

# ---------- JSONL helpers ---------
def append_jsonl(path: str, recs: Iterable[dict]):
    with open(path, "a", encoding="utf-8") as f:
        for r in recs:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

def read_jsonl(path: str) -> Iterable[dict]:
    if not os.path.exists(path): return []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)

def count_jsonl(path: str) -> int:
    if not os.path.exists(path): return 0
    with open(path, "r", encoding="utf-8") as f:
        return sum(1 for _ in f if _.strip())

# ---------- Backoff wrapper ----------
def with_backoff(call, *, max_attempts: int = RETRY_LIMIT, base_delay=0.5, jitter=0.2):
    for attempt in range(1, max_attempts + 1):
        try:
            return call()
        except Exception as e:
            if attempt == max_attempts:
                raise
            sleep = base_delay * (2 ** (attempt - 1)) + random.random() * jitter
            time.sleep(sleep)

# ---------- Prompt builders ----------
SKILL_SYSTEM_TEMPLATE = """You are a skill tagger for math word problems.
You read a problem and its solution, then output a concise, comma-separated list of skill tags
(e.g., "division, unit conversion, proportional reasoning").
- Invent new tags when helpful. Prefer 1–4 words per tag.
- Be consistent: prefer reusing tags from the provided examples when applicable.
- Avoid duplication or near-duplicates ("multiplication" vs "multiply").
- Prefer general concepts over overly fine-grained steps unless critical.
- Do not include difficulty in tags.
"""

def build_skill_user(problem: str, solution: str, examples: List[Tuple[str,str,List[str]]] | None) -> str:
    example_text = ""
    if examples:
        blocks = []
        for (p, a, tags) in examples:
            blocks.append(f"Example:\nQ: {p}\nA: {a}\nTAGS: {', '.join(tags)}")
        example_text = "\n\n".join(blocks) + "\n\n"
    return (
        example_text +
        "Now tag this item.\n"
        f"Q: {problem}\n"
        f"A: {solution}\n"
        "Return only the tags, comma-separated."
    )

DIFF_SYSTEM_TEMPLATE = """You are a judge comparing the relative difficulty of TWO grade‑school math problem+solution pairs.
Assess difficulty for a typical grade‑school student (ages ~8–12). Consider these heuristics:
- Number of reasoning steps
- Presence of multi-step arithmetic (esp. with carrying/borrowing) or unit conversions
- Need for forming equations/unknowns, proportional reasoning, or geometry reasoning
- Linguistic complexity and distractors
- Requirement to combine skills

Output a single character:
- '<' if the FIRST pair is EASIER than the second
- '>' if the FIRST pair is HARDER than the second
- '=' if they are roughly the same difficulty
No extra text.
"""

def build_diff_user(p1: str, a1: str, p2: str, a2: str) -> str:
    return (
        "FIRST:\n"
        f"Q1: {p1}\nA1: {a1}\n\n"
        "SECOND:\n"
        f"Q2: {p2}\nA2: {a2}\n\n"
        "Is the first easier (<), harder (>), or about the same (=)? Return exactly one of '<', '>', '='."
    )

# --------- Comparison cache key ---------
def pair_key(i: int, j: int) -> str:
    if i <= j:
        return f"{i}|{j}"
    return f"{j}|{i}"
