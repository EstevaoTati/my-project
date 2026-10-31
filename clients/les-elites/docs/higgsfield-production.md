# Higgsfield production — The House of Knowledge

Generated 2026-10-31 on the founder's Higgsfield account (Basic plan).

## Pipeline

1. **Master keyframe** (GPT Image 2.5, 16:9) — exterior at blue hour. Locks
   materials, palette, light direction and focal length for the whole film.
2. **Scene keyframes 2–5** — each generated *with the master as image
   reference*, so stone, bronze and warm light carry across spaces.
3. **Clips** (Kling 3.0, std, 7 s, silent, 16:9) — each animates its keyframe
   as `start_image`. Same camera grammar everywhere: slow, constant, forward,
   no rotation.
4. `scripts/prepare-media.sh` → keyframe every 6 frames, no audio, desktop +
   small-screen cuts, poster = frame 0.

Cost: 5 × 0.25 (keyframes) + 5 × 10.5 (clips) ≈ 54 credits. Kling *pro* mode
needs the Plus plan; Seedance 2.5 at 1080p costs 112 credits per clip.

## Shots

| # | Scene | Keyframe job | Clip job | Brief |
|---|---|---|---|---|
| 01 | Parvis des Idées | `1517f9a7-2707-4eaa-a93c-f99bae1d7dbe` | `d8fda6dd-27a1-45a3-a2d0-50a0dbe5dafe` | Founder's Scene 1: dolly-in to the glass entrance |
| 02 | Hall de l'Excellence | `58ccc968-2f5a-485b-b616-1f2df9e02521` | `2aee7991-6d50-4eb2-9719-dcbf6b87360f` | Glide past the bronze open-book sculpture |
| 03 | Grande Bibliothèque | `c4117b65-94a9-470c-b01e-7fffc65cf9d6` | `84666f8e-e0ab-4eb0-80d8-80b6d1ca924f` | Founder's Scene 2: forward between the shelves |
| 04 | Atelier des Auteurs | `ae12c876-9a7c-44f5-8f26-2049de453a8b` | `f189fc6f-a8ba-4f85-80a9-d94e0558f894` | Founder's Scene 3: manuscript → blank hardcover |
| 05 | Observatoire | `7faa1603-3381-46f9-927b-a04d26c218c1` | `05c6526f-f677-465e-9f1d-83572ea3e3eb` | Advance to the glass wall, ease to a full stop |

Full prompts are stored on each job in Higgsfield, and the clip URLs are in
`scripts/prepare-media.sh`.

## QA before committing media (human eyes required)

The build sandbox could not download the clips (CDN blocked by its network
policy), so **none of the five has been reviewed frame by frame yet**. Reject
and regenerate a clip if:
- geometry bends or "breathes" (walls, shelves, door frames must stay rigid)
- any text, letter-like marks or logos appear (the real logo is composited in HTML)
- scene 04's book cover is not blank
- the camera rotates or cuts

To regenerate one: same keyframe as `start_image`, same prompt, then replace
its URL in `prepare-media.sh`.

## Rules

- Never let a model draw the logo, a title or a real cover. Real covers live
  in `assets/books/` and are rendered by the site (CSS-3D shelf, panels).
- Scene 04 is a symbolic sequence; the page labels it "not a client project".
- Commercial rights: generated under the founder's Higgsfield plan; confirm the
  plan's commercial terms before launch.
- Next shots if budget allows: portrait (9:16) versions for phones, which look
  better than center-cropping 16:9, plus end→start bridge clips (Kling
  `start_image` + `end_image`) for seamless doorway transitions.
