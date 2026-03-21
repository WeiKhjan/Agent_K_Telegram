---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
---

# Skill Creator

Create, evaluate, and iterate on Claude Code skills.

## Quick Start

1. **Capture intent** — What should the skill do? When should it trigger? What's the output format?
2. **Write SKILL.md** — Frontmatter (name, description) + instructions. Keep under 500 lines.
3. **Test** — Create 2-3 test prompts, run evals, compare with/without skill.
4. **Iterate** — Improve based on feedback, rerun evals.

## Skill Structure

```
skill-name/
├── SKILL.md          # Required — frontmatter + instructions
├── scripts/          # Executable code for deterministic tasks
├── references/       # Docs loaded into context as needed
└── assets/           # Templates, icons, fonts
```

## Key Principles

- **Progressive disclosure**: metadata always loaded → SKILL.md on trigger → references on demand
- **Pushy descriptions**: combat undertriggering with explicit trigger phrases
- **Imperative instructions**: explain the *why*, not just the *what*
- **Keep it lean**: move large content to `references/` files

## Detailed Guide

For the full workflow (eval framework, benchmarking, description optimization, blind comparison):

→ Read `references/full-guide.md`

## Supporting Files

- `agents/grader.md` — Assertion grading
- `agents/comparator.md` — Blind A/B comparison
- `agents/analyzer.md` — Performance analysis
- `references/schemas.md` — JSON schemas for evals, grading, benchmarks
- `scripts/` — Eval runner, aggregator, description optimizer
- `eval-viewer/` — HTML report generator
