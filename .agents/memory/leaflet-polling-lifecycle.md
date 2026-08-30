---
name: Leaflet polling lifecycle
description: Preventing stale Leaflet animation callbacks when React polling or hot reload replaces a map.
---

Disable animated bounds and size transitions on maps rebuilt from polling data, and cancel pending timers plus call `map.stop()` before removing the map.

**Why:** In Replit preview, a Leaflet zoom-transition callback can run after React or hot reload removes the map pane, causing an `_leaflet_pos` runtime crash.

**How to apply:** Whenever map effect dependencies include live/polled objects, keep camera changes non-animated and make cleanup cancel every delayed callback before removing the instance.