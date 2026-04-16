# RecyclrJS

RecyclrJS exports `GX`, a small browser-side helper for fetching HTML and swapping fragments into the current DOM.

## Install

```bash
npm install recyclrjs
```

## Usage

```js
const GX = require('recyclrjs');

const gx = new GX({
  url: '/patients',
  method: 'get',
  selection: '#content@outerHTML->#content@outerHTML'
});

gx.request();
```

You can also import the named property:

```js
const { GX } = require('recyclrjs');
```

## Vanilla DOM

If you do not want Stimulus, mount the built-in delegated listeners once:

```js
const Recyclr = require('recyclrjs');

Recyclr.mount(document);
```

Example markup:

```html
<a href="/patients" data-gx-select="#content" recyclr="click">Patients</a>

<form action="/login" data-gx-select="#content" recyclr="submit">
  ...
</form>
```

## Realtime

If you already have a `GX` instance, you can feed it updates from WebSocket or SSE messages:

```js
const Recyclr = require('recyclrjs');

const gx = new Recyclr({
  url: '/patients',
  selection: '#content@innerHTML->#content@innerHTML'
});

const stream = Recyclr.createRecyclrStream({
  wsUrl: '/realtime',
  sseUrl: '/realtime',
  gx
});

stream.start();
```

The realtime payload should include `html`, and can optionally include `presets`, `eventName`, or `rules`.

## Notes

- This package is CommonJS and targets the browser.
- `mount()` and `createRecyclrStream()` are the no-Stimulus runtime APIs. The `controllers/` folder remains as an adapter/example, not a runtime requirement.
- The full implementation notes live in [`GX_DOCUMENTATION.md`](./GX_DOCUMENTATION.md).
