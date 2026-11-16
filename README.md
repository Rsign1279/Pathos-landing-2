# PATHOS — integrated original + planetary story

The founder's complete original landing page, with its 19 sections and
interactive experiences retained. The new planetary narrative applies only
to the twelve text sections selected in the reference screenshots.

The standalone planetary redesign is preserved on `main` in
[Rsign1279/Pathos-landing-2](https://github.com/Rsign1279/Pathos-landing-2),
at commit `df2831c`. Its production deployment is
[pathos-landing-2.vercel.app](https://pathos-landing-2.vercel.app/).
This integrated edition is on `integrate/original-planet-story`.

## Run

No installation or build is needed to serve the checked-in page:

```sh
python -m http.server 3000 --bind 127.0.0.1
```

Open http://localhost:3000/.

## Preserved original work

The marble-film hero, four proof results, project film, four-screen software
tour, ten-chapter hardware study and 360 view, six-photo deck, contact form,
and full footer remain in the page. They are outside the planet passages.

Inside the passages, all original content and interactions remain:

- Six partners, including roles, named mentors, coverage, and the press image.
- The problem chart and its three arguments.
- Four feature demonstrations and four selectable signal traces.
- Four model steps and the WESAD limitation.
- All six parts/controller rows, bus details, and component statuses.
- MVP 2 plans, seven roadmap milestones, and five workshops.
- The interactive place/verify/observe tutorial.
- The founder's biography, role, photo, five credentials, and LinkedIn.
- All four original FAQ questions and answers.

`deliverables/original-page.html` retains the exact original markup from
commit `6cfb566` so content preservation is directly auditable.

## Implementation

- `integration.css`: the new typography, palette, scoped planet layouts,
  responsive reading layout, and shared visual refinements.
- `integrated.css`: the existing styles plus the integration layer in one
  request. Regenerate it after changing a source stylesheet.
- `integration.js`: one shared optional WebGL planet across two passages.
  Text remains normal HTML; the original UI modules keep their behavior.
- `planet.js`: the lightweight analytic sphere and existing marble texture.
- `prototype-loader.js`: loads the original in-page hardware study only near
  its section. The study retains its bounded 16-frame cache.
- `hero.js` and `film.js`: preserve the real films, with deferred loading,
  visibility pauses, controls, and reduced-motion alternatives.

On phones the planet becomes a compact chapter companion, leaving the full
screen width available for the original content. No nested scroll container
or forced snapping is used. Fonts are served locally.

## Rebuild and verify

```sh
node deliverables/build-integrated.cjs
node deliverables/verify-integrated.cjs
```

The audit compares every original section's text and content collections,
validates assets/anchors, checks the planet's scope and original interaction
contracts, and checks JavaScript syntax. Browser QA separately verifies
desktop/mobile rendering, navigation, signals, media, hardware, photos,
FAQ, tutorial controls, and contact validation. QA never sends real emails.

`deliverables/verify-experience.cjs` belongs to the preserved standalone
edition; use the integrated audit on this branch.

## Research status

The working MVP 1 uses the ESP32 and BME280 environmental pipeline. Body
sensors, a wearable format, and caregiver alerts are MVP 2 development work.
WESAD research is not validated accuracy on PATHOS hardware. The site measures
no visitor physiological signals. PATHOS is not a medical device.
