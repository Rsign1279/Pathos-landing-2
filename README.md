# PATHOS — a world beneath the surface

A static, locally served landing page. The opening uses one scroll-driven,
stone-textured planet to tell the story behind PATHOS. Real prototype photos,
software screens, the project film, and community evidence follow it.

## Run locally

From this directory, run:

```sh
python -m http.server 3000 --bind 127.0.0.1
```

Open http://localhost:3000/. No installation or build step is required.

## Implementation

- `index.html`, `experience.css`, and `experience.js`: the responsive page,
  native chapter navigation, signal explorer, software tabs, native dialogs,
  FAQ, and progressive enhancement.
- `planet.js`: one analytic WebGL sphere, using the existing 114 KB marble
  texture. No 3D model, framework, or postprocessing is needed for the planet.
- `contact.js`: accessible validation and FormSubmit delivery. Delivery is
  confirmed by the service; failures retain the visitor's text.
- `hardware.html`, `hardware-launch.js`, and `prototype.js`: the original
  engineering study, loaded only when a visitor opens it. Its image sequence
  keeps at most 16 decoded frames and three concurrent requests.
- `assets/fonts/`: locally served Figtree and EB Garamond, with OFL licenses.

The planet renders at a capped pixel ratio and approximately 30 visual updates
per second. Rendering stops outside its section and while the page is hidden.
The motion control and system motion preference provide a still alternative.
Videos do not autoplay or preload. The hardware viewer does not load on the
main page. All essential narrative text remains ordinary HTML.

## Verify

```sh
node deliverables/verify-experience.cjs
```

This zero-dependency audit checks source syntax, internal links and assets,
landmarks, fallback behavior, loading boundaries, truthful project status,
and the bounded hardware frame cache. It reports a source asset budget;
it does not claim a Lighthouse score or measured network performance.

Browser QA covers phone, tablet, and desktop layouts; chapter navigation;
signal buttons; keyboard software tabs; photo dialogs; FAQ; and form errors.
No real contact messages are submitted during QA.

## Content boundaries

MVP 1's ESP32 and BME280 environmental pipeline is working. Physiological
sensors, the wearable format, and caregiver alerts are in development for
MVP 2. The hardware render is an engineering concept. WESAD model research
has not been validated on PATHOS hardware. PATHOS is a wellness research
prototype, not a medical device, and this site measures no visitor signals.

The original assets and rendering scripts remain in the repository. Older
stylesheets and page scripts are retained for history but are not requested
by the redesigned landing page.
