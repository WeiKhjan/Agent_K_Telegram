# Skill Creator — Full Guide

This is the complete reference for creating, evaluating, and optimizing skills.
Read this file when you need detailed instructions on any of the sections below.

## Table of Contents
- Communicating with the user
- Creating a skill (Capture Intent, Interview, Write SKILL.md, Skill Writing Guide)
- Running and evaluating test cases (Steps 1-5)
- Improving the skill (iteration loop)
- Advanced: Blind comparison
- Description Optimization
- Claude.ai-specific instructions
- Cowork-specific instructions
- Reference files

---

## Communicating with the user

The skill creator is liable to be used by people across a wide range of familiarity with coding jargon. Pay attention to context cues to understand how to phrase your communication. "evaluation" and "benchmark" are OK; for "JSON" and "assertion" you want to see cues from the user that they know what those things are before using them without explaining them.

---

## Creating a skill

### Capture Intent

Start by understanding the user's intent. The current conversation might already contain a workflow the user wants to capture. If so, extract answers from the conversation history first.

1. What should this skill enable Claude to do?
2. When should this skill trigger? (what user phrases/contexts)
3. What's the expected output format?
4. Should we set up test cases to verify the skill works?

### Interview and Research

Proactively ask questions about edge cases, input/output formats, example files, success criteria, and dependencies.

### Write the SKILL.md

- **name**: Skill identifier
- **description**: When to trigger, what it does. Make descriptions "pushy" to combat undertriggering.
- **compatibility**: Required tools, dependencies (optional)

### Skill Writing Guide

#### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

#### Progressive Disclosure

Skills use a three-level loading system:
1. **Metadata** (name + description) - Always in context (~100 words)
2. **SKILL.md body** - In context whenever skill triggers (<500 lines ideal)
3. **Bundled resources** - As needed (unlimited, scripts can execute without loading)

**Key patterns:**
- Keep SKILL.md under 500 lines
- Reference files clearly from SKILL.md with guidance on when to read them
- For large reference files (>300 lines), include a table of contents

#### Writing Patterns

Prefer using the imperative form in instructions. Explain the **why** behind instructions. Use theory of mind and make skills general, not super-narrow to specific examples.

### Test Cases

After writing the skill draft, come up with 2-3 realistic test prompts. Save test cases to `evals/evals.json`. See `references/schemas.md` for the full schema.

---

## Running and evaluating test cases

Put results in `<skill-name>-workspace/` as a sibling to the skill directory.

### Step 1: Spawn all runs (with-skill AND baseline) in the same turn

For each test case, spawn two subagents — one with the skill, one without.

### Step 2: While runs are in progress, draft assertions

Draft quantitative assertions for each test case.

### Step 3: As runs complete, capture timing data

Save `total_tokens` and `duration_ms` to `timing.json`.

### Step 4: Grade, aggregate, and launch the viewer

1. Grade each run using `agents/grader.md`
2. Aggregate: `python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>`
3. Do an analyst pass using `agents/analyzer.md`
4. Launch viewer: `python <skill-creator-path>/eval-viewer/generate_review.py <workspace>/iteration-N --skill-name "my-skill" --benchmark <workspace>/iteration-N/benchmark.json`

### Step 5: Read the feedback

Read `feedback.json` after the user reviews. Empty feedback means it was fine.

---

## Improving the skill

1. **Generalize from the feedback** — don't overfit to specific examples
2. **Keep the prompt lean** — remove things that aren't pulling their weight
3. **Explain the why** — theory outperforms rigid MUSTs
4. **Look for repeated work** — bundle common scripts in `scripts/`

### The iteration loop

1. Apply improvements
2. Rerun all test cases into a new `iteration-<N+1>/` directory
3. Launch the reviewer with `--previous-workspace`
4. Wait for user review
5. Read feedback, improve again, repeat

---

## Advanced: Blind comparison

Read `agents/comparator.md` and `agents/analyzer.md` for blind A/B comparison between two skill versions.

---

## Description Optimization

### Step 1: Generate 20 trigger eval queries (mix of should-trigger and should-not-trigger)
### Step 2: Review with user using `assets/eval_review.html`
### Step 3: Run optimization loop:

```bash
python -m scripts.run_loop \
  --eval-set <path-to-trigger-eval.json> \
  --skill-path <path-to-skill> \
  --model <model-id> \
  --max-iterations 5 \
  --verbose
```

### Step 4: Apply the `best_description` from JSON output

---

## Claude.ai-specific instructions

- No subagents — run test cases one at a time
- Skip baseline runs and quantitative benchmarking
- Present results directly in conversation
- Description optimization requires `claude` CLI (skip on Claude.ai)

## Cowork-specific instructions

- Use `--static <output_path>` for eval viewer (no browser/display)
- GENERATE THE EVAL VIEWER before evaluating inputs yourself

---

## Reference files

- `agents/grader.md` — How to evaluate assertions against outputs
- `agents/comparator.md` — How to do blind A/B comparison
- `agents/analyzer.md` — How to analyze why one version beat another
- `references/schemas.md` — JSON structures for evals.json, grading.json, etc.
