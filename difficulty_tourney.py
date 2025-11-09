
"""
Compute a total preorder of difficulty using pairwise OpenAI comparisons.
- Uses a merge-sort–style tournament that naturally recurses.
- Ties "=" create equivalence groups.
- Caches pairwise results to JSONL so we never re-ask the same comparison.
- Highly parallel at each merge layer.

usage:
  OPENAI_API_KEY=... python difficulty_tourney.py
"""
from __future__ import annotations
import os, json, itertools
from typing import List, Tuple, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

from config import *
from utils import append_jsonl, read_jsonl, get_client, with_backoff, DIFF_SYSTEM_TEMPLATE, build_diff_user, pair_key

# ---- Load items (from TAGGED_PATH if present, else raw) ----
def load_items(limit: int | None = None) -> List[dict]:
    src = TAGGED_PATH if os.path.exists(TAGGED_PATH) else RAW_ORCA_PATH
    if not os.path.exists(src):
        raise SystemExit("No data found. Run download_and_tag.py first (or put raw JSONL at RAW_ORCA_PATH).")
    out = []
    for rec in read_jsonl(src):
        out.append(rec)
        if limit and len(out) >= limit:
            break
    return out

# ---- Comparison cache ----
def load_compare_cache() -> Dict[str, str]:
    cache: Dict[str,str] = {}
    for rec in read_jsonl(COMPARE_CACHE):
        k = rec.get("k"); r = rec.get("r")
        if k and r in ("<",">","="):
            cache[k] = r
    return cache

def cache_write(pairs: List[Tuple[Tuple[int,int], str]]):
    recs = [{"k": pair_key(i,j), "r": r} for (i,j), r in pairs]
    append_jsonl(COMPARE_CACHE, recs)

# ---- OpenAI comparator ----
def compare_many(client: OpenAI, items: List[dict], idx_pairs: List[Tuple[int,int]]) -> Dict[Tuple[int,int], str]:
    results: Dict[Tuple[int,int], str] = {}
    def do_pair(i,j):
        p1,a1 = items[i]["question"], items[i]["answer"]
        p2,a2 = items[j]["question"], items[j]["answer"]
        user = build_diff_user(p1,a1,p2,a2)
        def _call():
            resp = client.chat.completions.create(
                model=DIFF_MODEL,
                messages=[
                    {"role":"system","content":DIFF_SYSTEM_TEMPLATE},
                    {"role":"user","content":user},
                ],
                temperature=0.0,
                max_tokens=4,
            )
            return resp
        r = with_backoff(_call)
        symbol = r.choices[0].message.content.strip()
        symbol = symbol[:1] if symbol and symbol[0] in "<>=" else "="
        return ((i,j), symbol)
    with ThreadPoolExecutor(max_workers=MAX_WORKERS_DIFF) as ex:
        futs = [ex.submit(do_pair, i,j) for (i,j) in idx_pairs]
        for f in as_completed(futs):
            pair, sym = f.result()
            results[pair] = sym
    # persist
    cache_write(list(results.items()))
    return results

# ---- Merge with total preorder (groups) ----
def merge_groups(client: OpenAI, items: List[dict], left: List[int], right: List[int], cache: Dict[str,str]) -> List[List[int]]:
    """Left and right are lists of indices that may already be grouped by equal difficulty.
       We merge into a list of equivalence groups (list of lists)."""
    # Expand groups: we store as list[list[int]]; if flat, wrap
    def ensure_groups(xs):
        if len(xs) == 0: return []
        if isinstance(xs[0], list): return xs # already grouped
        return [[x] for x in xs]

    lg = ensure_groups(left)
    rg = ensure_groups(right)

    # We'll merge group by group. For each pair of groups (Lgrp vs Rgrp), compare representative items.
    out: List[List[int]] = []
    li, ri = 0, 0
    while li < len(lg) and ri < len(rg):
        Lgrp, Rgrp = lg[li], rg[ri]
        # Compare a representative pair (first elements)
        i, j = Lgrp[0], Rgrp[0]
        k = pair_key(i,j)
        if k in cache:
            sym = cache[k]
        else:
            res = compare_many(client, items, [(i,j)])
            sym = res[(i,j)]
            cache[k] = sym

        if sym == "<":       # left easier -> goes earlier
            out.append(Lgrp)
            li += 1
        elif sym == ">":     # right easier -> it goes earlier
            out.append(Rgrp)
            ri += 1
        else:                # '=' tie: merge groups (equivalence)
            out.append(sorted(Lgrp + Rgrp))
            li += 1; ri += 1

    # Append remainder
    while li < len(lg):
        out.append(lg[li]); li += 1
    while ri < len(rg):
        out.append(rg[ri]); ri += 1
    return out

def tournament_sort(client: OpenAI, items: List[dict]) -> List[List[int]]:
    """Return list of equivalence groups (each group is a list of item indices).
       Earlier groups are EASIER. Later groups are HARDER."""
    n = len(items)
    indices = list(range(n))

    # Bottom-up merge sort in groups, enabling parallel compares at each merge
    width = 1
    cache = load_compare_cache()
    while width < n:
        new_groups: List[List[int]] = []
        for i in range(0, n, 2*width):
            left = indices[i : i+width]
            right = indices[i+width : i+2*width]
            if not right:
                new_groups.extend([[x] for x in left])
                continue
            merged = merge_groups(client, items, left, right, cache)
            # Flatten groups into indices for next layer, but we keep group boundaries by inserting markers
            flat = list(itertools.chain.from_iterable(merged))
            new_groups.extend(merged)
        # After one full pass, rebuild indices from groups in order
        indices = list(itertools.chain.from_iterable(new_groups))
        width *= 2
    # One pass produced groups aligned; convert indices back to grouped form using cached comparisons
    # We already have groups in new_groups from the last iteration when n>1.
    # Edge case: n==1
    if n <= 1:
        return [[0]] if n==1 else []
    # Build groups again from final pass
    # Since we lose boundaries after final flatten, compute groups by single left-to-right compare
    groups: List[List[int]] = [[indices[0]]]
    for k in range(1, len(indices)):
        prev = groups[-1][0]
        cur = indices[k]
        key = pair_key(prev, cur)
        sym = load_compare_cache().get(key)
        if sym is None:
            sym = compare_many(client, items, [(prev, cur)])[(prev, cur)]
        if sym == "=":
            groups[-1].append(cur)
        else:
            groups.append([cur])
    return groups

def assign_ranks(groups: List[List[int]]) -> Dict[int, int]:
    """Lower rank number = easier. Equal items share same rank."""
    ranks = {}
    for r, grp in enumerate(groups, start=1):
        for idx in grp:
            ranks[idx] = r
    return ranks

def main():
    client = get_client()
    items = load_items()  # load all tagged or raw
    groups = tournament_sort(client, items)
    ranks = assign_ranks(groups)

    # Write final combined JSONL (question, answer, skill_tags?, difficulty_rank)
    out_recs = []
    for idx, rec in enumerate(items):
        out = {
            "id": rec.get("id", idx),
            "question": rec["question"],
            "answer": rec["answer"],
            "skill_tags": rec.get("skill_tags", []),
            "difficulty_rank": int(ranks[idx]),
        }
        out_recs.append(out)
        if len(out_recs) >= 1000:
            append_jsonl(FINAL_PATH, out_recs)
            out_recs.clear()
    if out_recs:
        append_jsonl(FINAL_PATH, out_recs)
    print(f"Wrote ranks to {FINAL_PATH}")

if __name__ == "__main__":
    main()
