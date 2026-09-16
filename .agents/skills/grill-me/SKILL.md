---
name: grill-me
description: >-
  Grill the user relentlessly about a plan, decision, or idea before implementing.
  Conducts an interactive interview in rounds along the decision tree frontier, providing recommended answers.
  Use when the user types '/grill-me', asks to be grilled, or wants to stress-test their ideas.
---

# Grill Me

Conduct a relentless, iterative interview to sharpen a plan, architecture, or idea before writing code or taking action.

## Core Philosophy

- **Stateless & Focused**: Do not rush to produce a plan or modify files. The objective is to refine and settle decisions in the user's mind and achieve a shared understanding.
- **Decision Tree**: Every high-level decision branches into sub-decisions that depend on it.
- **Frontier in Rounds**: Group all questions whose prerequisites are settled into the current round (the "frontier"). Never ask a question that hinges on an unsettled prerequisite.
- **Active Dialogue**: Give clear, opinionated recommendations for each question so the user can easily accept, modify, or push back.

---

## Interview Execution Rules

1. **Find Facts Yourself**:
   - Never ask the user for information you can discover directly from the repository, filesystem, or tools.
   - If a question depends on exploring code or documentation, inspect it first. Decisions belong to the user; factual discovery belongs to the agent.

2. **Work the Frontier in Rounds**:
   - In each round, ask all current unblocked questions at once.
   - Number each question clearly.
   - Provide your **recommended answer** for each question (`➡️`).
   - Stop and wait for the user's response before proceeding.

3. **Round Format**:

```markdown
❓ **Q1** - **<Question Title>**: <Concise explanation of the decision, trade-offs, or choices>

➡️ **Recommended**: <Your recommended option and rationale>

---

❓ **Q2** - **<Question Title>**: <Concise explanation of the decision, trade-offs, or choices>

➡️ **Recommended**: <Your recommended option and rationale>
```

4. **Iterate**:
   - Each answer settles decisions and unblocks new branches downstream.
   - Recompute the new frontier and present Round 2, Round 3, etc.
   - If a user's answer introduces new ambiguities, add the resulting questions to the next round.

5. **Completion**:
   - The grilling session is complete when the frontier is empty: all branches have been traversed and no hidden assumptions remain.
   - Summarize the settled decisions and confirm mutual alignment before taking any implementation actions.
