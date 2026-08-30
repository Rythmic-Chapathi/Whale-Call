---
name: Public map label ownership
description: Why public overview charts use a self-contained nautical chart instead of labeled third-party tiles.
---

Public destination and booking charts should render Whale Call's island shapes, labels, ports, and routes on a self-contained nautical background. Do not add labeled basemap tiles or fleet markers to these overview charts.

**Why:** Standard map tiles caused duplicate geographic labels, while a third-party no-label tile endpoint introduced an API-key watermark. Fleet markers also obscured the tightly grouped island names.

**How to apply:** Keep operational boat markers only in fleet, supply-tracking, and trip contexts where they carry task-specific meaning. If adding a tile provider later, verify it is label-free, watermark-free, and authorized for production use.