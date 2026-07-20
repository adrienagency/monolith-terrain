# Render upgrades — plan (2026-07-20)

## Decision: adaptive quality, NOT a forked "high mode"

The question was: build a separate high-end mode, or accept losing weak
machines? Neither. The app already has an adaptive tier governor
(src/perf.js) that measures real frame times and sheds pixelRatio, shadows
and MSAA in tiers. The new effects become two more levers on that ladder:

- Tier 0-1 (fast machines): SSAO + Bloom on
- Tier 2: SSAO off (it is the costlier of the two — an extra normal pass)
- Tier 3: Bloom off too — the app looks like it did before this plan

One product, every machine serves the best image it can hold at 60 fps. A
forked mode would mean two looks to maintain and a choice the user should
never have to make; the governor already exists and already works.

## Phase A — engine (this session)

1. Anisotropy 8 → 16 on aerial textures (free sharpness at grazing angles).
2. SSAO: postprocessing's SSAOEffect + NormalPass, own EffectPass right
   after the RenderPass (AO multiplies the HDR buffer before DoF/tonemap).
   Params: ssaoEnabled (true), ssaoIntensity.
3. Bloom: BloomEffect (mipmapBlur) in its own pre-tonemap pass.
   Params: bloomEnabled (true), bloomIntensity, bloomThreshold.
4. perf.js: aoPass/bloomPass handed to the governor; tier 2 kills AO,
   tier 3 kills bloom. Manual toggles write both params and pass state.
5. TEMPLATE_KEYS += the five new params; applyRenderFx() pushes them on
   template load.

## Phase B — UI (this session)

6. The 24h slider leaves the Create panel for a minimalist PILL, fixed
   top-right above the Templates panel: sun glyph, slim range, hour readout.
7. New right-side panel "Effects" below Map: Render (AO/Bloom), Post
   (exposure/contrast/saturation/vignette/grain/fog — moved verbatim from
   Create), Clouds (moved verbatim). Create loses those three sections.

## Phase C — later, in order of visual payoff

8. God rays (GodRaysEffect needs a sun DISC mesh — the astronomical sun
   position from daycycle.js gives it a physically true anchor).
9. Lake reflections (SSR, custom) — the "matière qui reflète le soleil".
10. Cascaded shadow maps (three/addons CSM) for the grazing-sun hours.
11. TAA — NOT in postprocessing 6.x; would need three's TAARenderPass on a
    separate composer path. Hardest item here, deferred deliberately.
