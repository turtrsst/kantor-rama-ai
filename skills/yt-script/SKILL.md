# yt-script

## When to use

- Use this skill when the user asks for a YouTube video script or a hook or an opening line.

- Use this skill when the user says what should I say or write my next video or is about to record and does not have the first fifteen seconds yet.

- Use this skill for PUTRI when she drafts a script for Alfa.

## Before you write

- Ask for the creator voice first when you do not have it, meaning how they talk on camera and the words they never use and who they are talking to and what they will not claim.

- Ask for three of their own videos when no voice profile exists, read or transcribe them, infer the voice, and save the profile in a note for later scripts.

- Never invent a number or a result or a source.

- Ask for a figure that would strengthen the script when you do not have one, or write the line without it.

## Score the hook, do not eyeball it

- Run the scorer in `scripts/` on every hook option before you choose one.

- Score a single hook with `python3 ~/workspace/custom-skills/yt-script/scripts/hookscore.py --hook "one line"`.

- Rank a file of hooks with `python3 ~/workspace/custom-skills/yt-script/scripts/hookscore.py hooks.txt`.

- Treat a low score as a reason to look again and never treat a high score as a promise.

- Know the scorer limits: it separates deliberately bad hooks from real ones well and separates one creator hits from their own misses barely at all.

## The 21 hook formulas

- Use the formulas in `scripts/hooks.json` and write five hook options against them.

- The formulas are The Statistic and Someone Else's Result and The Mistake and Contrarian Flip and The Reveal and The Superlative and The Clock and I Tried It and The Question and Before and After and The Teardown and The Stack and The Warning and The List and The Receipt and The Insider and The Impossible Claim and The Comparison and The Origin and The Deadline and Direct Address.

- Follow the formula rules: confirm the title in the first sentence, keep one idea per hook, prefer a specific number over a big vague word, show the artifact inside 20 seconds when you promised one, and never open with who you are.

## The shape of the script

- Treat the first 15 seconds as the whole job.

- Make the hook do three things: confirm the click the title promised, open a question the viewer cannot close, and prove the payoff exists.

- Keep the top two scored hooks and show the user both with their scores.

- Never hand over one hook only.

- Write the turn at 0:15 to 0:45 as one sentence saying what the video will do, then start doing it.

- Cut any channel intro and any before we get started and any subscribe pitch from the opening.

- Write the body as one idea per beat and mark each beat with what is ON SCREEN, not just what is said.

- Deliver the payoff the hook promised explicitly and say that you are delivering it.

- Close with one ask and not three.

## What to hand back

- Hand back the two best hooks with their scored panels.

- Hand back the script beat by beat with `[ON SCREEN: ...]` on every beat.

- Hand back the runtime estimate at 150 words per minute.

- Hand back one line naming which formula the winning hook used and why it fits this idea.

## The approval gate

- End every run with the question ship it, or change it?

- Never publish anything yourself and never hand a script to RAGA for editing before Alfa approves it.

- Treat a revision request as a new run of the same steps and re-score any changed hook.

- Record which hook and which beats Alfa approved so RAGA edits the approved version only.

## Source and limits

- Adapted from yt-script by Jake Schincariol under the MIT License.

- Source repository is https://github.com/Jakeschincariol/youtube-agent-skill

- The scorer and the formulas live in `scripts/` beside this file and were reviewed before copying: the scorer uses only the Python standard library, reads its own formulas file, and makes no network call.

- The upstream voice profile path under a Claude Code home folder does not apply in Muse and was replaced with asking the user and saving a note.

- The upstream plugin install commands do not apply in Muse and were not used.

- Use `muse.skill_search` to discover this skill and use the Muse tools in the current session to do the work.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.
