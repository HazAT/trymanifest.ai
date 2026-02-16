---
name: manifest-merge-conflicts
description: Resolve merge conflicts from upstream or other repos. Preserves application identity while accepting framework and tooling improvements. Use when you see merge conflict markers, failed merges, or the user says "resolve conflicts", "fix merge", or "merge conflict".
---

# Manifest Merge Conflict Resolution

Resolve merge conflicts intelligently. The cardinal rule: **never change what the app is supposed to be.** Framework improvements, prompt refinements, and documentation polish from upstream are welcome. Application-specific features, business logic, and identity are sacred.

**When to use:** You see conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), a merge or rebase has failed, or the user asks for help resolving conflicts.

---

## Philosophy

Merge conflicts in Manifest are not just code conflicts — they're *intent* conflicts. Two lines of development diverged, and now you need to understand what each side was trying to do before you can reconcile them.

The upstream repo evolves the framework, CLI, docs, skills, and conventions. Your project evolves the application — features, schemas, services, config, and vision. When these collide, the app wins. Always.

**Accept from upstream:**
- Framework code improvements (`manifest/`)
- CLI enhancements (`manifest/cli/`)
- Prompt and skill text refinements (`.claude/skills/`, `AGENTS.md` framework sections)
- Documentation polish and typo fixes
- New conventions that don't break existing patterns
- New extensions and extension updates

**Protect from your project:**
- `VISION.md` — this is YOUR app's soul, upstream has no say
- `features/` — your application behavior, never overwritten
- `schemas/` — your data model
- `services/` — your business logic
- `config/` — your configuration choices
- `MANIFEST.md` — regenerated from YOUR project, not upstream
- Application-specific sections of `AGENTS.md`
- Any custom extensions you've built

---

## Steps

### 1. Assess the Situation

Before touching anything, understand what happened:

```bash
# What state are we in?
git status

# How many files have conflicts?
git diff --name-only --diff-filter=U

# What was the merge/rebase command that caused this?
git log --merge --oneline 2>/dev/null || echo "Not in a merge state"
```

### 2. Read MANIFEST.md

Check the current project index to understand what the app looks like right now:

```bash
cat MANIFEST.md
```

Pay attention to:
- What features exist — these are the app's behaviors, they must be preserved
- What extensions are installed — these represent deliberate choices
- What schemas exist — this is the data model, it's authoritative
- Recent changes — context for what was being worked on

### 3. Understand the Divergence

Look at git history to see where and why things diverged:

```bash
# Find the common ancestor
git merge-base HEAD MERGE_HEAD 2>/dev/null || git merge-base HEAD upstream/main

# See what YOUR side changed since the fork point
MERGE_BASE=$(git merge-base HEAD MERGE_HEAD 2>/dev/null || git merge-base HEAD upstream/main)
git log --oneline $MERGE_BASE..HEAD

# See what THE OTHER SIDE changed since the fork point
git log --oneline $MERGE_BASE..MERGE_HEAD 2>/dev/null || git log --oneline $MERGE_BASE..upstream/main
```

Read the commit messages on both sides. They tell you the *intent* behind each change. In Manifest, commit messages are knowledge transfer — use them.

### 4. Categorize Each Conflicted File

For every conflicted file, decide which category it falls into:

```bash
# List all conflicted files
git diff --name-only --diff-filter=U
```

**Category A: Framework files (`manifest/`)**
Take upstream's version unless you've made deliberate local modifications. If you have local changes, read both versions and merge the intent — keep your customizations, adopt upstream's improvements.

```bash
# If you haven't modified this file locally, just take upstream
git checkout --theirs manifest/some-file.ts
```

**Category B: Application files (`features/`, `schemas/`, `services/`, `config/`)**
Keep YOUR version. These define what your app is. Upstream's versions are templates/examples — they have no authority over your application.

```bash
# Keep your version
git checkout --ours features/some-feature.ts
```

**Category C: Documentation and skills (`AGENTS.md`, `.claude/skills/`, `README.md`)**
This is nuanced. These files have two layers:
- **Framework documentation** (how Manifest works) — accept upstream improvements
- **Application documentation** (what YOUR app does) — keep yours

For `AGENTS.md`: upstream may have improved the framework sections (How to Write a Feature, Common Commands, The Framework table). Accept those. But any section describing YOUR app's architecture, conventions, or decisions stays yours.

For skills: upstream may have refined prompts, added better examples, or fixed instructions. These are generally safe to accept — they're improvements to the tooling, not changes to your app.

**Category D: Generated files (`MANIFEST.md`, `bun.lockb`)**
These get regenerated. Don't waste time resolving them manually.

```bash
# For MANIFEST.md — regenerate after resolving everything else
git checkout --ours MANIFEST.md

# For lockfile — reinstall after resolving
git checkout --theirs bun.lockb 2>/dev/null || true
```

**Category E: Vision file (`VISION.md`)**
Always keep yours. No exceptions.

```bash
git checkout --ours VISION.md
```

### 5. Resolve Each Conflict

Work through files one at a time. For each:

1. **Read the full file** — don't just look at the conflict markers
2. **Read both sides of each conflict block** — understand what each is trying to do
3. **Decide** — based on the categories above
4. **Edit** — resolve the conflict, keeping the right intent from each side
5. **Stage** — `git add <file>` when resolved

For complex conflicts in shared files (like `AGENTS.md`), read the conflict blocks carefully:

```bash
# See the conflict in context
git diff <file>
```

The markers look like:
```
<<<<<<< HEAD (yours)
Your version of this section
=======
Their version of this section
>>>>>>> upstream/main (theirs)
```

### 6. Handle AGENTS.md Specifically

`AGENTS.md` is the most common and trickiest conflict. It has framework docs AND project docs in one file.

**Framework sections that upstream may improve** (accept improvements):
- "How to Write a Feature/Test/Schema/Service" examples
- "Common Commands" table
- "The Framework" file table (line counts, descriptions)
- "Response Envelope" format
- Principles text (wording refinements)

**Project sections you must protect** (keep yours):
- Any custom conventions you've added
- Project-specific architecture notes
- Custom extensions documentation
- Anything referencing YOUR features, schemas, or services by name

When in doubt: if a change makes the documentation more accurate or clear without changing what the app does, accept it.

### 7. Regenerate and Verify

After resolving all conflicts:

```bash
# Reinstall dependencies (in case package.json or lockfile changed)
bun install

# Regenerate the manifest index from YOUR project
bun run manifest index

# Stage the regenerated file
git add MANIFEST.md

# Run all checks
bun test
bunx tsc --noEmit
bun run manifest check
```

All three must pass before completing the merge.

### 8. Complete the Merge

```bash
# Stage all resolved files
git add -A

# If in a merge state
git commit
# The default merge commit message is fine, but add a body explaining
# what you accepted, adapted, and rejected from the incoming side.
```

Write the merge commit body following the manifest-commit conventions:

```
merge: integrate upstream changes (abc1234..def5678)

Accepted:
- manifest/server.ts: improved error handling for streams
- manifest/cli/check.ts: new convention checks
- .claude/skills/manifest-commit: refined prompt wording

Protected (kept ours):
- features/*: all application features preserved as-is
- VISION.md: our app identity unchanged
- config/manifest.ts: our port and auth settings

Adapted:
- AGENTS.md: accepted framework doc improvements, kept our
  custom architecture section and extension docs

All tests pass. tsc clean. manifest check clean.
```

---

## Rules

1. **VISION.md is untouchable.** Always keep yours. It defines what the app IS.
2. **Features are sovereign.** Your `features/`, `schemas/`, `services/` are your application. Upstream versions are irrelevant templates.
3. **Framework improvements are welcome.** Better code in `manifest/` is a gift — accept it unless it breaks your customizations.
4. **Prompt and doc polish is safe.** Refined wording in skills, AGENTS.md framework sections, and README is almost always an improvement. Accept it.
5. **Config is yours.** Your `config/` reflects your deployment, your secrets, your choices. Keep it.
6. **MANIFEST.md is never merged.** It's regenerated from your project. Always.
7. **When you don't know, ask the user.** If a conflict is ambiguous — both sides made meaningful changes and you can't tell which matters more — present both versions and ask.
8. **Test after resolving.** No merge is complete until `bun test`, `tsc`, and `manifest check` all pass.
9. **Document what you did.** The merge commit should list what was accepted, protected, and adapted so the next update knows the decisions you made.

---

## Guiding the User

When helping a user through merge conflicts, be explicit about what you're doing and why:

1. **Show them the conflict count** — "There are 7 conflicted files. Here's how I'd categorize them..."
2. **Explain each decision** — "This is a framework file and upstream improved it. I'll take their version." or "This is your feature file. I'll keep yours."
3. **Flag ambiguous cases** — "AGENTS.md has conflicts in both framework docs and your custom section. I'll accept their wording improvements but keep your architecture notes. Sound right?"
4. **Summarize at the end** — List what was accepted, what was kept, and what was adapted.

The user should never feel like their app changed out from under them. They should feel like the tooling got better while their application stayed exactly what they built.
