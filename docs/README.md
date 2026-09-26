# Documentation

Reference material for Codyssey — a browser-based platform for building and running cognitive
experiments. Setup instructions are in the [root README](../README.md); this folder is for how
the system works and what it does.

## Table of contents

| Document | What it covers |
|---|---|
| [architecture.md](architecture.md) | How the system is built and why — the two-bundle split, the timing engine, the builder compiler, the AI pipeline, the data model, request pipeline, and the shortcuts taken deliberately |
| [privacy.md](privacy.md) | Exactly what participant data is collected, how participants stay anonymous, consent and withdrawal, security controls, and an explicit list of known gaps |
| [api-reference.md](api-reference.md) | Full HTTP specification — conventions, error codes, all six data models, and every endpoint with request and response examples |
| [api-routes.md](api-routes.md) | One-page route table with an auth-level legend, for scanning rather than reading |
| [roadmap.md](roadmap.md) | Build status phase by phase, prioritised outstanding work, the demo runbook, and a list of claims that were previously wrong |

## Where to start

| If you want to… | Read |
|---|---|
| Run it locally | [root README](../README.md#quickstart) |
| Understand the timing claims | [architecture.md § The timing engine](architecture.md#the-timing-engine) |
| See what data a participant gives you | [privacy.md § What a participant actually discloses](privacy.md#what-a-participant-actually-discloses) |
| Call the API | [api-routes.md](api-routes.md) for the shape, [api-reference.md](api-reference.md) for the details |
| Know what is finished and what is not | [roadmap.md](roadmap.md) |
| Understand the experiment format | [api-reference.md § Data Models](api-reference.md#data-models), or `frontend/src/shared/experimentSchema.js` |
| Understand the AI generation | [architecture.md § AI experiment generation](architecture.md#ai-experiment-generation) |

## Conventions used in these docs

- **Verified claims.** Every factual statement about the code was checked against it while
  writing. Numbers — route counts, assertion counts, bundle sizes, column counts — are counted,
  not estimated.
- **File references are paths.** `engine/scheduler.js` means
  `frontend/src/engine/scheduler.js` unless the section says otherwise; backend paths are given
  from `backend/`.
- **Known gaps are listed, not hidden.** [privacy.md](privacy.md) and
  [roadmap.md](roadmap.md) both have explicit gap tables. A reviewer finding an issue
  unmentioned is a worse outcome than one finding it documented.
- **`[x]` / `[~]` / `[ ]`** in the roadmap mean built-and-verified, built-with-a-known-gap, and
  not-started respectively.
- **A note on the AI's capabilities.** The generation pipeline is deliberately restricted to
  text stimuli — `CAPABILITIES` in `backend/src/services/aiCatalog.js` states plainly that it
  cannot produce images, audio, sliders, questionnaires or cue-target sequences, and instructs
  the model to build the closest supported approximation and disclose it in `notes`. The
  *builder and runtime* do support image and audio stimuli for hand-authored experiments; the
  restriction is on generation only.
