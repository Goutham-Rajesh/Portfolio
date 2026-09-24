# Portfolio — interactive hero

Zero-build static site: plain HTML, CSS and vanilla JavaScript. No framework or bundler is required.

## Run locally

Any static file server works. With Python installed:

```bash
python -m http.server 5173
```

Then open <http://localhost:5173>.

## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Nav, hero, and the Work / About / Experience / Skills / Education / Contact sections |
| `css/hero.css` | Design tokens (navy and steel-blue palette), hero gradient and glow, typography, responsive rules |
| `css/site.css` | Styles for the content sections below the hero |
| `js/hero.js` | Zone detection, state machine, rAF-driven crossfades |
| `assets/frames/*.jpg` | Character frames cropped to a shared 1300×1080 composition |
| `media/` | Original animation frame exports (source material, not served) |

## Interaction model

The hero is divided into three horizontal zones. The pointer only selects a zone; the character never tracks the cursor.

| Zone | Frame | Message | Behaviour |
| --- | --- | --- | --- |
| Left | `look-left` | "Anyone here on the left?" | Holds ~2.5 s, returns to `working` |
| Right | `look-right` | "Anyone here on the right?" | Holds ~2.5 s, returns to `working` |
| Center | `excited` → `headset-off` → `wave` → `point` | "Hey, it's you!" → "Hiiii!" → "Check out the portfolio" | Uninterruptible; returns to `working` |

Reactions fire on zone entry only, so resting the pointer in a zone does not loop the animation.

On mobile (or coarse-pointer tablets) the zones are removed. The greeting plays once when the hero scrolls into view and can be replayed by tapping the character.

## Editing timings

Frame holds and messages live in the `GREETING` array and `HOLD_SIDE_MS` constant at the top of `js/hero.js`. Crossfade length is `FADE_MS`.
