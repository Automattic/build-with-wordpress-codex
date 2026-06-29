# WordPress.com Plugin Evals

This directory contains three levels of submission-readiness checks for the WordPress.com Codex plugin.

## 1. Static Checks

Static checks validate the local plugin package without calling the OpenAI API.

```bash
node evals/static-checks.mjs
```

They check JSON parsing, required plugin metadata, logo references, `.env` ignore coverage, skill front matter, and eval case structure.

## 2. Local Agent Evals

Local agent evals use a real model call through the OpenAI Responses API. The model receives the plugin skill instructions and a realistic tool surface, then decides which tools to call. Tool implementations are deterministic stubs, so runs are repeatable and do not modify live WordPress.com sites or local Studio sites.

```bash
node evals/run-local.mjs
```

Useful options:

```bash
node evals/run-local.mjs --case ambiguous-site-edit-asks-target
node evals/run-local.mjs --model gpt-5-mini
node evals/run-local.mjs --dry-run
```

The runner reads `OPENAI_API_KEY` from the environment or `.env`, writes `evals/results/latest.json`, and exits non-zero when any case fails.

These evals grade behavior that matters for this plugin:

- local Studio vs. live WordPress.com routing
- required and forbidden tool calls
- no live writes before confirmation
- no tools for generic WordPress coding help
- no purchase or checkout claims
- final answer facts reviewers should see

## 3. Live Smoke Runs

Use `evals/live-smoke.md` for submission-facing manual runs in the real Codex product with the real plugin and a review account. Those runs should capture prompt, account/site fixture, transcript link, tool calls, final answer, pass/fail, and follow-up fixes.

## Case Source

`cases.jsonl` is derived from `hero-cases.md` and includes a few extra regression cases for generic coding help, collaborator management, and local auditing.
