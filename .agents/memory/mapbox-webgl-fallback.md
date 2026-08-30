---
name: Mapbox WebGL fallback
description: Why browser maps need a non-WebGL rendering path in this project.
---

Mapbox initialization must be guarded and replaced with a useful location summary when WebGL is unavailable.

**Why:** Replit's automated screenshot browser can disable WebGL, causing Mapbox GL to throw during construction even when the token and integration are valid.

**How to apply:** Preserve the interactive Mapbox path for supported browsers, but never let a WebGL initialization failure take down the surrounding page.