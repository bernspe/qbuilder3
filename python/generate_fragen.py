#!/usr/bin/env python3
"""
Generates interview questions for each ICF code using the Claude CLI.
Processes codes in batches and saves results incrementally.
"""
import json
import subprocess
import sys
import os

BATCH_SIZE = 20
INPUT_FILE = "icf_codes_4digit.json"
OUTPUT_FILE = "../src/assets/icf_codes_mit_fragen.json"
PROMPT_FILE = "prompt1.txt"

def read_prompt():
    with open(PROMPT_FILE, "r") as f:
        return f.read()

def call_claude(prompt_text: str, batch_json: str) -> dict:
    """Call claude CLI with the given prompt and batch JSON, return parsed dict."""
    full_input = f"{prompt_text}\n\nHier sind die ICF-Items:\n{batch_json}"
    result = subprocess.run(
        ["claude", "-p", full_input],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Claude CLI error: {result.stderr}")
    output = result.stdout.strip()
    # Strip markdown code fences if present
    if output.startswith("```"):
        lines = output.splitlines()
        # remove first and last fence line
        output = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    return json.loads(output)

def main():
    # Load all ICF codes
    with open(INPUT_FILE, "r") as f:
        icf_codes = json.load(f)

    prompt = read_prompt()
    codes = list(icf_codes.keys())
    total = len(codes)
    print(f"Total codes: {total}")

    # Load existing output if it exists (resume support)
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r") as f:
            result = json.load(f)
        print(f"Resuming: {len(result)} codes already processed")
    else:
        result = {}

    # Filter out already processed codes
    remaining = [c for c in codes if c not in result]
    print(f"Remaining: {len(remaining)} codes to process")

    # Process in batches
    for i in range(0, len(remaining), BATCH_SIZE):
        batch_codes = remaining[i:i + BATCH_SIZE]
        batch_data = {c: icf_codes[c] for c in batch_codes}
        batch_json = json.dumps(batch_data, ensure_ascii=False, indent=2)

        print(f"Processing batch {i//BATCH_SIZE + 1}: codes {i+1}-{min(i+BATCH_SIZE, len(remaining))} of {len(remaining)}", flush=True)

        try:
            batch_result = call_claude(prompt, batch_json)
            result.update(batch_result)
            # Save incrementally after each batch
            with open(OUTPUT_FILE, "w") as f:
                json.dump(result, f, ensure_ascii=False, indent=4)
            print(f"  -> Saved {len(result)}/{total} codes total")
        except Exception as e:
            print(f"  ERROR in batch {i//BATCH_SIZE + 1}: {e}", file=sys.stderr)
            # Save what we have so far and continue
            with open(OUTPUT_FILE, "w") as f:
                json.dump(result, f, ensure_ascii=False, indent=4)
            print(f"  -> Partial save: {len(result)} codes. Continuing...")
            continue

    print(f"\nDone! {len(result)}/{total} codes processed.")
    print(f"Output saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
