# GX (RecyclrJS) — HTML Swaps + Stimulus “Singleton” Controller

GX is a tiny “server-driven UI” helper: it **fetches HTML**, **parses the response**, **picks out fragments**, and **swaps them into the current DOM** based on `data-gx-*` attributes.  
Think “HTMX-ish”, but intentionally lightweight and designed to work cleanly with Stimulus.

This documentation matches the current implementation in:

- `index.js` (GX core)
- `gx-controller.js` (Stimulus controller that owns a single GX instance)
- `index.blade.php`, `side.blade.php` (example markup patterns)

---

## 1) Mental Model

1. User clicks a link / button, or submits a form.
2. Stimulus controller `gx#handleRequest` reads `data-gx-*` attributes.
3. The `GX` instance is configured (URL/method/form/select rules) and then `gx.request()` runs.
4. `GX.request()`:
    - `fetch()`es the URL
    - reads the HTML as text
    - picks **swap rules** (either from the element’s `data-gx-select` or via presets)
    - extracts fragments from the response using `DOMParser`
    - performs DOM swaps
    - optionally pushes browser history
    - optionally dispatches a custom event (default: `gx:updated`)

---

## 2) Why the GX Stimulus Controller Must Be a Singleton

### The core rule

**Only one `GX` instance should exist per page.**

Creating a new `GX` instance per click can stack global listeners (especially `popstate`) and can burn CPU/memory (Firefox is extra sensitive here). The patched controller intentionally creates **exactly one** `GX` instance inside `connect()` and reuses it for every request.

✅ Good:

- `connect()` creates `this.gx = new GX(...)`
- `handleRequest()` only updates properties on `this.gx` and calls `this.gx.request()`

❌ Bad:

- `handleRequest()` creates `new GX(...)` every time

---

## 3) Quick Start

### 3.1 Add the controller once (usually on `<body>`)

```html
<body data-controller="gx">
    ...
</body>
```

### 3.2 Trigger a swap with a click

```html
<a
    href="/patients"
    data-action="click->gx#handleRequest"
    data-gx-select="#content"
>
    Patients
</a>
```

### 3.3 Trigger a swap with a form submit

```html
<form
    action="/login"
    method="post"
    data-action="submit->gx#handleRequest"
    data-gx-select="#content #sidebar"
>
    ...
</form>
```

> Tip: Always include the event in `data-action` (`click->` / `submit->`).  
> The shorthand `data-action="gx#handleRequest"` is easy to forget and harder to reason about.
> By default, the selector for the input is the output, and the default location is outerHTML, so if you find yourself writing #content@outerHTML->#content@outerHTML, you can just write #content
> Also by default, data-gx-method is get, so you can really slim it down to something like <a href="http://foo.bar" data-gx-select="#content" data-action="click->gx#handleRequest">Hello World</a>

---

## 4) `data-gx-*` Attribute Reference

GX reads these attributes from the clicked/submitted element:

### Required

- **`data-gx-select`**  
  Swap rule string describing what to extract from the response and where to place it in the current DOM.

### Optional

- **`data-gx-url`**  
  Overrides the URL. If missing, GX will fall back to:
    - `href` for anchors/buttons
    - `action` for forms

- **`data-gx-method`**  
  `get | post | put` (lowercase preferred). If missing, GX falls back to the element’s `method` attribute or defaults to `get`.

- **`data-gx-form`**  
  CSS selector for the form whose fields should be submitted. Useful when a button is outside the `<form>`.

- **`data-gx-history`**  
  `on | off` (defaults to `on` in the controller unless overridden).  
  When enabled, GX will `history.pushState()` after a successful request.

- **`data-gx-debug`**  
  `on | off` (defaults to `off`). Enables verbose debug logging.

- **`data-gx-loading`** _(implemented)_  
  CSS selector for a spinner element. GX sets `display: block` while the request runs and hides it afterwards.

- **`data-gx-presets`** _(advanced)_  
  Overrides which presets are available for the request.

> Notes on incomplete/placeholder attributes:
>
> - `data-gx-disable` and `data-gx-error` currently exist in the controller plumbing, but the GX core does not yet apply them (they’re stored but not acted on).

---

## 5) Swap Rules (`data-gx-select`) Syntax

A swap rule has the general form:

```
<sourceSelector>@<sourceLocation> -> <targetSelector>@<targetLocation>
```

Rules are separated by spaces.

### 5.1 Minimal form (location defaults to `outerHTML`)

```
#content
```

### 5.2 Full form

```
#content@outerHTML->#content@outerHTML
```

### 5.3 Multiple swaps in one request

```
#content@outerHTML->#content@outerHTML #sidebar@outerHTML->#sidebar@outerHTML
```

### 5.4 Supported target locations

These target locations are currently supported by `GX.render()`:

- `innerHTML`
- `outerHTML`
- `beforebegin`
- `afterbegin`
- `beforeend`
- `afterend`

Target insertion uses `insertAdjacentHTML()` for the `before*/after*` variants.

### 5.5 Source “locations” (what you extract from the response)

For the **source**, GX reads a property off the response element:

```js
doc.querySelector(sourceSelector)[sourceLocation];
```

So you can technically use any string property on an Element (e.g., `innerHTML`, `outerHTML`, `textContent`, `value`), **but** keep in mind:

- If your target location is not one of the supported ones (section 5.4), `render()` will throw.
- In practice, stick to `innerHTML` and `outerHTML`.

### 5.6 Conditional rules (reserved)

Rules may be prefixed with:

```
condition:...
```

Example:

```
redirect:#content@outerHTML->#content@outerHTML
```

Right now, conditions are only used in a limited way internally (ex: redirect/error paths). Treat this as reserved unless you’re extending GX.

### 5.7 Property list syntax (parsed but **not implemented**)

The `Location` helper parses bracket syntax like:

```
#avatar@outerHTML[src,alt]->#avatar@outerHTML
```

…but the actual “update only these props” logic is not implemented yet. Currently, if brackets are present, GX will short-circuit that rule.

---

## 6) Presets System (Optional, but Powerful)

GX can choose swap rules automatically via a “presets” configuration.

### 6.1 How presets are selected

`GX.evaluateWithPresets()` will use presets if any of these are true:

- Server returns a `Recyclr-Use-Presets` header (comma/semicolon separated list)
- A trigger is matched:
    - `response.redirected` → `config.triggers.redirect`
    - `response.status` → `config.triggers["status:<code>"]`

If no preset is chosen, GX falls back to the request’s `data-gx-select`.

### 6.2 Presets config shape

```js
{
  presets: {
    refreshContent: [
      "#content@outerHTML->#content@outerHTML",
      "#sidebar@outerHTML->#sidebar@outerHTML"
    ],

    // You can also provide a rule object:
    toast: { literal: "<div>Saved</div>", dst: "#toasts", dstLoc: "beforeend" }
  },

  fallback: "refreshContent",

  triggers: {
    redirect: ["refreshContent"],
    "status:401": ["refreshContent"]
  }
}
```

### 6.3 Loading presets externally + TTL cache

If `config.presetsUrl` is set, GX loads presets once and caches them in `localStorage` using `config.presetsTTLMs`.

This is meant for “drop-in behavior changes” without redeploying JS.

---

## 7) Browser History / Back-Forward Behavior

When history is enabled for a request:

- GX calls `history.pushState(null, 'Page Title', this.url)`

The Stimulus controller installs **one** `popstate` listener to re-run a GET request and refresh `#content`.

If you would rather force a full page reload on back/forward, comment in the `location.reload()` line in the controller.

---

## 8) Custom Events

When `dispatch` is enabled:

- GX dispatches a `CustomEvent` on `document` (or the provided target)
- Event name format is:

```
<identifier>:<eventName>
```

With the default config, that’s typically:

- `gx:updated`

You can override the event name from the server via `Recyclr-Event` response header.

### Example listener

```js
document.addEventListener("gx:updated", (e) => {
    console.log("GX updated:", e.detail);
});
```

---

## 9) Performance & Memory Safety Checklist (Firefox-Friendly)

If you hear your laptop fans rev up after lots of navigation/modals, check these first:

### 9.1 Ensure you aren’t appending forever

Using target locations like `beforeend` / `afterend` **adds nodes** without removing old ones. That’s fine for “toasts”, but not for “pages”.

For pages/modals, prefer:

- A fixed container, swapped via `innerHTML` or `outerHTML`

### 9.2 Avoid global listeners in swapped components

Stimulus controllers **should** clean up on `disconnect()`, but only if:

- you attach listeners in `connect()` and remove them in `disconnect()`
- you don’t attach listeners to `window/document` without cleanup

### 9.3 Do not create a new GX per request

Again: **singleton GX instance**. Creating a new instance per click can stack listeners and retain references.

### 9.4 Cancel in-flight requests (nice-to-have)

GX currently doesn’t abort previous requests. If a user clicks rapidly, you can end up doing extra work.
If this becomes a real problem, add `AbortController` support in `GX.request()`.

---

## 10) Known Limitations / TODOs

- `data-gx-disable` is not applied yet (busy-state helper exists, but GX never targets a real element selector).
- `data-gx-error` is not displayed yet (stored but unused).
- Bracket property lists (`@outerHTML[src,alt]`) are parsed but not implemented.
- Target locations are limited to the list in section 5.4.

---

## 11) Troubleshooting

### “Nothing updated”

- Check that `data-gx-select` points at selectors that exist in the **response HTML**.
- Open DevTools → Network → verify response contains the fragment you expect.

### “Target selector not found”

- The _target_ selector must exist in the current DOM at the time of swap.
- If you are swapping the container that contains the trigger, avoid self-destructing the click target mid-flight.

### “Firefox CPU spikes”

- Look for repeated `popstate` listeners or duplicated controllers.
- Ensure modals are swapped/reused, not appended repeatedly.

---

## 12) Examples From Our Blade Templates (Patterns)

### “Swap main content + sidebar”

```html
<a
    href="/some/page"
    data-action="click->gx#handleRequest"
    data-gx-method="get"
    data-gx-select="#content #side-nav"
>
    Go
</a>
```

### “Submit a form and refresh key regions”

```html
<form
    action="/save"
    method="post"
    data-action="submit->gx#handleRequest"
    data-gx-select="#content@outerHTML->#content@outerHTML #alerts@innerHTML->#alerts@innerHTML"
    data-gx-loading="#global-spinner"
>
    ...
</form>
```

---

## 13) Extending GX (Recommended Next Steps)

If you want to tighten up UX and reduce bugs:

1. **Wire `data-gx-disable` into `applyBusyState()`**
    - Use `this.disable` as a selector for the container you want to lock during requests.

2. **Implement bracket property updates**
    - In `GX.evaluate()`, when `Location.properties()` returns a list, update only those properties on the _target element_.

3. **Add AbortController**
    - Store `this._abort` in GX and abort previous in-flight requests on a new request.

That combo makes GX feel much closer to “production HTMX” without losing the simplicity.

---
