# Higgsfield production — The House of Knowledge

Art direction: **warm classic library**, chosen by the founder on 2026-10-31
(see `docs/decisions/2026-10-31-les-elites-warm-classic-direction.md` in the
parent repo). Generated on the founder's Higgsfield account (Basic plan).

## Pipeline

1. **Master keyframe**: the Grand Hall (GPT Image 2.5, 16:9). Walnut on two
   levels, painted vault, brass chandelier, Persian rug, banker's lamp,
   chesterfield. It fixes materials, palette and light for every other shot.
2. **Scene keyframes**: each generated with the master as `image_references`,
   so wood, rugs and amber light carry from room to room. The founder's four
   reference images are described in the prompts. They could not be uploaded
   from the build sandbox, because the upload host is blocked.
3. **Clips** (Kling 3.0 *std*, 7 s, silent): each animates its keyframe as
   `start_image`. One camera grammar throughout: slow, constant, forward, no
   rotation.
4. `scripts/prepare-media.sh` downloads and encodes. Scroll scenes get a
   keyframe every 6 frames, no audio, desktop + small-screen cuts and a
   frame-0 poster. The catalogue loop uses a normal GOP.

### Plan limits learned the hard way

- Kling *pro* mode requires the Plus plan.
- **Basic runs 2 videos at a time.** A third concurrent job fails with a
  misleading "Out of credits on basic (monthly) plan" even when credits
  remain. Submit two, wait, submit two.
- Costs: keyframe 0.25 cr, Kling std 7 s 10.5 cr. Seedance 2.5 at 1080p is
  112 cr per clip.

## Shots (current)

| # | Scene | Keyframe job | Clip job |
|---|---|---|---|
| 01 | Façade → doors (neoclassical stone, dusk) | `cad7ddd2-890f-4d0e-9919-16deac3be43a` | `24cd0c43-fd9b-4cfa-871a-05552e890a4d` |
| 02 | Grand Hall (**master**) | `05fb4cb4-4703-4273-88c2-b0945a3fb5d4` | `fa0e5267-a2d5-4c5a-8634-1005ba8995af` |
| 03 | Reading room: ladder, rug | `8e294f85-efdc-4174-a43b-c2589f523fbf` | `0c7c155b-7762-4fe9-b4b6-a060880a8fbc` |
| 04 | Study: manuscript → blank navy hardcover | `114a6637-a8c0-412f-a34c-42bd0c8360d3` | `792b09d4-ce5a-4bc2-bb33-9481483b900f` |
| 05 | Top floor: arched windows at sunrise | `436ec715-efa0-4aaf-a765-42bbbe5b9368` | `4d77447b-47c5-42d6-acd4-5c3442042a75` |
| — | Catalogue header loop (9:16, shelves) | `f400a068-bc1d-43b8-8adf-b756cf09634e` | `754c3a5b-d49a-434b-8a21-d1354f9032dc` |

Full prompts are stored on each job in Higgsfield. The download URLs are in
`scripts/prepare-media.sh`.

**Superseded** (contemporary dark-stone first cut; still in the Higgsfield
library, not used): keyframes `1517f9a7…`, `58ccc968…`, `c4117b65…`,
`ae12c876…`, `7faa1603…`; clips `d8fda6dd…`, `2aee7991…`, `84666f8e…`,
`f189fc6f…`, `05c6526f…`.

## QA before committing media (human eyes required)

The build sandbox cannot download from Higgsfield's CDN, so **no clip has
been reviewed frame by frame yet**. Reject and regenerate a clip if:
- geometry bends or "breathes": shelves, balustrades, arches and the
  chandelier must stay rigid
- letters, titles or logos appear (the real logo and covers are rendered by
  the site)
- the book cover in scene 04 is not blank
- the camera rotates or cuts

To regenerate one: same keyframe as `start_image`, same prompt, then replace
its URL in `prepare-media.sh`.

## Rules

- Classic, not medieval: no castles, torches or stone dungeons.
- Never let a model draw the logo, a title or a real cover.
- Scene 04 is symbolic; the page labels it "not a client project".
- The founder's reference image of the scroll corner carried a **Grok**
  watermark. Check xAI's terms before using that original anywhere, and never
  publish it with the mark.
- Commercial rights: confirm the Higgsfield plan's commercial terms before
  launch.

## Next shots, if the budget allows

- Portrait (9:16) versions of scenes 2–4 for phones: animate a 9:16 keyframe
  made from the same master. Phones currently get a centre crop of 16:9.
- Bridge clips (Kling `start_image` = end of scene N, `end_image` = start of
  scene N+1) to replace the cross-fade with one continuous take.
