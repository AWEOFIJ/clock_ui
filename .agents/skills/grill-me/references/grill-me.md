# grill-me Reference

Source: [mattpocock/skills (docs/productivity/grill-me.md)](https://github.com/mattpocock/skills/blob/main/docs/productivity/grill-me.md)

## What it does

`grill-me` takes a **loose idea** and interviews you until you can commit to it. You do not need a worked-out plan to start: producing one is what the session is for. It asks in **rounds**: each round is the whole **frontier** (every question whose prerequisites you have already settled), so you are never asked something that hinges on an answer it hasn't heard yet.

It is **stateless**. It writes no files and leaves no workspace behind. The only thing it leaves is a sharper version of the idea, in your own head.

## When to reach for it

You invoke this by typing `/grill-me`; the agent won't reach for it on its own. Start it in a **fresh conversation**, not on top of a plan you already had an agent write.

Reach for it as soon as you have an idea worth taking seriously (a feature, a product direction, a business call, a piece of writing), and long before you have worked out what it involves. Vagueness is not a reason to wait; it is the thing the session eats. If you can already specify the thing precisely, you don't need to grill it.

Which of the three grilling skills you want depends on what is in front of you:

- **Anything, anywhere**: `grill-me`. It needs no repo and writes no files, and the subject doesn't have to be code.
- **A codebase to align against**: `grill-with-docs`. The same interview, but stateful: it reads your code and keeps what it learns in `CONTEXT.md` and ADRs.
- **Too big for one session**: `wayfinder`. It charts the effort as a map and runs grilling sessions inside it.

Leave plan mode off. Plan mode primes the agent to rush toward producing a plan, which is the opposite of staying in inquiry.

## It's a conversation, not an interview

The skill asks the questions, but **you** own the scope. That is the part people miss, and it separates a session that turns an idea into decisions from one that produces confident nonsense.

The failure mode is **passivity**: answering "agreed, agreed, agreed" for forty questions and coming out with a plan the agent wrote and you nodded at. It feels productive because it was long. Nothing was actually decided, and the result carries a certainty it hasn't earned.

Being active means steering. Push back on a question pitched beneath the fidelity you need. Say when the scope is drifting. Answer "I don't know" and mean it. This skill is built to aid an engineer, not to replace one: what comes out tracks the judgment you put in.
