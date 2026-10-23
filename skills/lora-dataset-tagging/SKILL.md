---
name: lora-dataset-tagging
description: Tag a LoRA training dataset (a character, creature, object or style) through the Images Tag Manager for LORAs MCP server. Use when the user asks to tag, caption or retag the photos open in Images Tag Manager, to "tag this character/subject", to clean up or make a dataset's tags consistent, or when the images-tag-manager MCP tools (list_photos, get_photo, add_tags, remove_tags, set_tags, list_project_tags) are available and the task is about tagging. Not for generating images or writing prompts.
---

# Tagging a LoRA dataset with Images Tag Manager

You are tagging the photos the user has open in **Images Tag Manager for LORAs**, through its MCP server. Good tags decide what the LoRA learns: what you tag can be changed at generation time, what you leave out gets absorbed into the trigger word. Work like a careful human tagger: look at every image, be consistent, and never invent what you cannot see.

## How the program behaves (read before the first call)

- **Nothing is saved by you.** Every change stays inside the program; the `.txt` files are written only when the user presses **Save Changes**. There is no save tool. Always end by asking the user to review and save.
- **A comma splits a tag.** In the `.txt` files the comma separates tags, so `"soft light, rim light"` becomes two tags. `remove_tags` splits the same way. Never put commas inside a tag; for a sentence caption (Flux-style) write it without commas or ask the user first.
- **Tags are kept in alphabetical order** and duplicates that differ only in case are merged, keeping the spelling already there. Do not try to control the order.
- **Trigger words** (shown by `list_photos` and `list_project_tags`) are always kept first and cannot be removed with `remove_tags`. Do not add them again as normal tags.
- **Filtered lists are recomputed at every call.** With `tags` or `untagged_only`, a photo you change may leave the list and shift the pages. Read *all* pages first, note the ids, then change tags.
- `get_photo` returns the image resized to at most 1024 px, without hidden metadata. Fine details may be too small to read: if you are not sure, leave the tag out. Some formats (for example TIFF or HEIC) cannot be shown and `get_photo` answers with an error: skip those photos, do not tag them blind, and list them for the user at the end.
- A photo marked `txt_unreadable` has a `.txt` the program could not read: Save will not write it. Tell the user instead of tagging it.
- Answers report `changed`, `unchanged` and `not_found`: check them. `not_found` means a wrong id.

## Workflow

### 1. Survey before touching anything
1. `list_photos` with `limit` up to 500; if `total` is larger, advance `offset` by the number returned until a page comes back empty. Note every id and name.
2. `list_project_tags`: the existing vocabulary and trigger words. Reuse the spellings already in the project instead of creating near-duplicates (`blue eyes` vs `blue_eyes` vs `eyes blue`).
3. `get_photo` on **every** photo. Never tag an image you have not looked at. On large sets, look at them in batches and tag batch by batch.

### 2. Ask what the subject is (first time only)
After looking at the photos and before writing any tag, tell the user in one or two lines what you see (for example: "a green and blue furry dragon-like creature with a crystal crest, in a 3D animated style") and ask:

> What is this subject? Is it a **known character** (from a film, series, game, comic, a real-world breed or object) that I can look up online, or an **original character** you created?

- **Known character**: ask for the name and where it comes from if you are not sure. Then study it online (official pages, wikis, reference images) before tagging: its exact name, what kind of creature or person it is, its distinctive features (colors, markings, accessories, body shape), and what is typical of the source style. Use this to pick precise, consistent tags (`eastern dragon` rather than just `lizard`), and to tell constant traits from what changes in each image. Never tag a feature you read about but cannot see in the image.
- **Original character**: ask the user to describe it briefly: what it is (species or type), its name or the trigger word they want, the features that never change (colors, markings, outfit, accessories) and anything easy to get wrong. Do not search online for it.

Ask once per dataset. If the project already has trigger words or tags that name the subject, or the user already told you, do not ask again; just confirm in one line what you understood.

### 3. Agree on three things with the user (once, briefly)
- **Trigger word**: is there one already (see `trigger_words`)? If not, should there be? Trigger words are set in the program by the user, not through MCP.
- **Model family**: booru-style tags (SDXL, Pony, Illustrious, NoobAI, SD 1.5) or natural-language captions (Flux and similar). Default: booru-style tags.
- **Constant traits of the subject** (fur color, eye color, a crest, a scar, an outfit that never changes): *tag them* to keep them editable at generation time, or *leave them out* so they bind to the trigger word. If the user has no preference: leave out the traits that define the subject, tag everything that varies.

If the user already told you, or the project's existing tags make it obvious, do not ask again.

### 4. Shared tags first, in one call
Use one `add_tags` with all the ids for what is true in every image:
- the **general class** *and* the **specific type**: `dragon` + `eastern dragon`, `cat` + `maine coon`, `girl` + `1girl`. The general word is easy to forget and is what most prompts use.
- the **medium/style** if constant: `3d`, `anime screencap`, `photo`, `pixel art`, `watercolor`.
- the subject's name or franchise only if the user wants it as a tag.

### 5. Per-image tags, grouped
Tag what *varies* between images, in this order of importance. Group photos that share a tag and add it with one `add_tags` per group:
1. **Framing**: `close-up`, `portrait`, `upper body`, `cowboy shot`, `full body`.
2. **View and angle**: `from side`, `from behind`, `from above`, `from below`, `three-quarter view`, `looking at viewer`, `looking away`, `looking down`.
3. **Pose and action**: `standing`, `sitting`, `lying`, `flying`, `running`, `holding <object>`, `outstretched hand`.
4. **Expression**: `smile`, `frown`, `angry`, `surprised`, `closed eyes`, `open mouth`, `teeth`.
5. **Objects and props** the subject holds or wears: `glowing orb`, `sword`, `hat`.
6. **Setting and background**: `forest`, `sky`, `mountain`, `indoors`, `simple background`, `white background`.
7. **Time, light and weather**: `night`, `dusk`, `sunset`, `backlighting`, `rim light`, `fog`, `wind`, `rain`.
8. **Image defects you want the model to keep separate**: `blurry`, `motion blur`, `text`, `watermark`, `letterboxed`, `cropped`.

Typical result: 10 to 25 tags per image. Fewer means you missed things that vary; many more usually means noise.

### 6. Rules for every tag
- Lowercase English, short, concrete, one idea per tag. Spaces, not underscores, unless the project already uses underscores.
- Only what is **visible**. No guesses about names, age, story, mood behind the scene or brand.
- No quality or aesthetic boosters (`masterpiece`, `best quality`, `beautiful`) unless the user asks: they are prompt words, not dataset facts.
- No commas inside a tag (see above).
- Same thing, same word, in every image: pick one of `dusk`/`twilight`/`evening` and stick to it.
- Use `set_tags` only to rewrite one photo from scratch; prefer `add_tags`/`remove_tags` so you do not drop tags the user wrote.

### 7. Check before handing back
1. `list_photos` with `untagged_only: true` returns `total: 0`, or only the photos you skipped because `get_photo` could not show them.
2. `list_project_tags`: look for near-duplicates, typos and tags used on one photo only that should be on more (or removed).
3. Spot-check a few photos with `list_photos` and compare against the images.
4. Give the user a short summary: shared tags, per-image groups, anything you were unsure of, and photos you skipped and why.
5. Remind the user that nothing is on disk yet: they review the tags in the program and press **Save Changes**.

## Retagging an already tagged dataset
Read the existing tags first and keep the user's conventions. Remove only what is wrong (`remove_tags`), add what is missing (`add_tags`), and list in your summary every tag you removed, so the user can put it back before saving.
