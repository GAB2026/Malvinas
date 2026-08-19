---
name: Warm screen-off behavior
description: Product decision for handling unreliable WebView GPU texture recovery after screen-off or backgrounding.
---

## Product rule

Warm sessions are foreground-only: a screen-off or an intentional user exit to
Home/app switcher ends the session, and the next launch starts with a fresh
native Activity and WebView rather than trying to resume the prior surface.

**Why:** Hardware-accelerated WebViews on some Android/OEM combinations can
return from screen-off with colored GPU texture corruption. Static artwork,
software layers, dynamic layer switching, renderer reloads, and native overlays
did not provide a trustworthy recovery path. A clean restart is preferable to
showing a visibly broken therapy screen.

**How to apply:** Stop the session before the Activity is discarded. Do not
force-kill the process. Preserve exceptions for transient system flows such as
Google Play Billing; they must not be mistaken for the user abandoning Warm.
Normal GPU animation is acceptable because Warm does not resume the old WebView
after a true exit.
