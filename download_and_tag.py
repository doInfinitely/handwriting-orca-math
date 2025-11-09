
"""
Download Microsoft Orca Math Word Problems 200k and skill‑tag each item with OpenAI.
Saves streaming JSONL checkpoints so you can resume anytime.

usage:
  OPENAI_API_KEY=... python download_and_tag.py
"""
from __future__ import annotations
import os, re, json, math, random
from typing import List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from datasets import load_dataset
from openai import OpenAI
from config import *
from utils import append_jsonl, read_jsonl, count_jsonl, get_client, with_backoff, SKILL_SYSTEM_TEMPLATE, build_skill_user

def load_orca_stream() -> List[dict]:
    ds = load_dataset("microsoft/orca-math-word-problems-200k", split="train", streaming=True)
    for i, row in enumerate(ds):
        # Each row has 'question' and 'answer' keys.
        yield {"id": i, "question": row.get("question","").strip(), "answer": row.get("answer","").strip()}

def previously_tagged_ids() -> set[int]:
    done = set()
    for rec in read_jsonl(TAGGED_PATH):
        if "id" in rec:
            done.add(rec["id"])
    return done

def select_examples(max_examples: int = 12) -> List[Tuple[str,str,List[str]]]:
    """Read already-tagged records to use as few-shot examples in prompt."""
    out = []
    for rec in read_jsonl(TAGGED_PATH):
        tags = rec.get("skill_tags", [])
        if isinstance(tags, list) and rec.get("question") and rec.get("answer"):
            out.append((rec["question"], rec["answer"], tags))
        if len(out) >= max_examples:
            break
    return out

def tag_batch(client: OpenAI, items: List[dict], examples: List[Tuple[str,str,List[str]]]):
    messages = []
    # We'll call API per item (parallel by ThreadPool), not batch in a single request, to simplify retries.
    out_records = []
    def do_one(it):
        q = it["question"]; a = it["answer"]
        user = build_skill_user(q, a, examples)
        def _call():
            resp = client.chat.completions.create(
                model=SKILL_MODEL,
                messages=[
                    {"role":"system","content":SKILL_SYSTEM_TEMPLATE},
                    {"role":"user","content":user},
                ],
                temperature=0.2,
                max_tokens=256,
            )
            return resp
        resp = with_backoff(_call)
        text = resp.choices[0].message.content.strip()
        # Parse tags (comma-separated)
        tags = [t.strip() for t in re.split(r"[;,]", text) if t.strip()]
        return {**it, "skill_tags": tags}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS_SKILL) as ex:
        futs = [ex.submit(do_one, it) for it in items]
        for f in as_completed(futs):
            out_records.append(f.result())
    append_jsonl(TAGGED_PATH, out_records)

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    client = get_client()
    done = previously_tagged_ids()
    buf = []
    stream = load_orca_stream()
    for rec in stream:
        if rec["id"] in done: 
            continue
        buf.append(rec)
        if len(buf) >= SKILL_BATCH_SIZE:
            examples = select_examples()
            tag_batch(client, buf, examples)
            buf = []
    if buf:
        examples = select_examples()
        tag_batch(client, buf, examples)
    print(f"Tagged written to {TAGGED_PATH} (count so far: {count_jsonl(TAGGED_PATH)})")

if __name__ == "__main__":
    main()
