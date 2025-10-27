
// --- recyclr: presets storage cache (TTL) ------------------------------------
function __recyclrStorageAvailable() {
    try {
        const x = '__recyclr__' + Math.random().toString(36).slice(2);
        window.localStorage.setItem(x, '1');
        window.localStorage.removeItem(x);
        return true;
    } catch (_) { return false; }
}

function __recyclrPresetsCacheKey(url) {
    return `recyclr:presets:${url}`;
}

function __recyclrReadPresetsCache(url, ttlMs) {
    if (!__recyclrStorageAvailable()) return null;
    try {
        const raw = window.localStorage.getItem(__recyclrPresetsCacheKey(url));
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;
        const now = Date.now();
        if (typeof obj.ts !== 'number' || (ttlMs > 0 && (now - obj.ts) > ttlMs)) {
            return null;
        }
        return obj.data || null;
    } catch (_) { return null; }
}

function __recyclrWritePresetsCache(url, data) {
    if (!__recyclrStorageAvailable()) return;
    try {
        const obj = { ts: Date.now(), data };
        window.localStorage.setItem(__recyclrPresetsCacheKey(url), JSON.stringify(obj));
    } catch (_) { }
}

async function __recyclrLoadPresetsWithCache(url, ttlMs) {
    // Try cache first
    const cached = __recyclrReadPresetsCache(url, ttlMs);
    if (cached) { return { data: cached, fromCache: true }; }
    // Otherwise fetch and cache
    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return { data: null, fromCache: false };
        const data = await res.json();
        __recyclrWritePresetsCache(url, data);
        return { data, fromCache: false };
    } catch (_) {
        return { data: null, fromCache: false };
    }
}
// --- end storage cache --------------------------------------------------------


// --- Recyclr Presets system --------------------------------------------------
function __recyclrParseRule(ruleStr) {
    // "<srcSel>@<srcLoc> -> <dstSel>@<dstLoc>" OR 'literal("...") -> <dstSel>@<dstLoc>'
    const parts = String(ruleStr || '').split(/->/);
    if (parts.length !== 2) return null;
    const L = parts[0].trim();
    const R = parts[1].trim();
    const mR = R.match(/^(?<dst>.+?)@(?<dstLoc>[a-zA-Z][\w-]*)$/);
    if (!mR) return null;
    const right = { dst: mR.groups.dst.trim(), dstLoc: mR.groups.dstLoc.trim() };

    const lit = L.match(/^literal\((?<lit>.*)\)$/i);
    if (lit) {
        let v = lit.groups.lit.trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        return { literal: v, ...right };
    }

    const mL = L.match(/^(?<src>.+?)@(?<srcLoc>[a-zA-Z][\w-]*)$/);
    if (!mL) return null;
    return { src: mL.groups.src.trim(), srcLoc: mL.groups.srcLoc.trim(), ...right };
}

function __recyclrNormalizeLoc(loc) {
    switch ((loc || 'innerHTML')) {
        case 'text': return 'textContent';
        case 'append': return 'beforeend';
        default: return loc;
    }
}

async function __recyclrLoadPresetsExternal(url) {
    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return null;
        return await res.json();
    } catch (_) { return null; }
}

function __recyclrBuildEventsFromPresetRules(html, rules) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const events = [];
    for (const rule of (rules || [])) {
        let selection = '';
        if (typeof rule.literal === 'string') {
            selection = rule.literal;
        } else if (rule.src) {
            const node = doc.querySelector(rule.src);
            if (!node) { __recyclrDebugLog(this, 'preset src missing', rule.src); continue; }
            const srcLoc = __recyclrNormalizeLoc(rule.srcLoc || 'innerHTML');
            if (srcLoc === 'outerHTML') selection = node.outerHTML;
            else if (srcLoc === 'textContent') selection = node.textContent;
            else selection = node.innerHTML;
        } else {
            __recyclrDebugLog(this, 'preset rule invalid', rule); continue;
        }
        const dstLoc = __recyclrNormalizeLoc(rule.dstLoc || 'innerHTML');
        events.push({ selector: rule.dst, location: dstLoc, selection });
    }
    return events;
}
// --- end presets system ------------------------------------------------------


// --- recyclr: debug utility ---
function __recyclrDebugLog(ctx, ...args) {
    try {
        const debugOn = !!(ctx && (ctx.debug || (ctx.config && ctx.config.debug)));
        if (debugOn && typeof console !== 'undefined' && console.log) {
            __recyclrDebugLog(this, '[recyclr]', ...args);
        }
    } catch (e) {
        /* no-op */
    }
}
// --- end debug utility ---


class GX {

    history = false // allow for updating the location / history of the browser
    debug = false // allow for debugging code
    dispatch = false // allow for dispatching events
    method = 'get' // request method, get|put|post|delete|patch|etc
    url = null // the url string that we're sending our request to
    form = null // form HTML element ( in stimulus, we just pass in the srcElement, not this.element, the controller goes on the document body)
    selection = null // a string to describe what we want to select and replace selectionSelector@location->targetSelector@location
    identifier = null // event name when dispatching
    loading = null // selector query string, show spinner
    error = null // selector query string, show error
    disable = null // selector query string, disable all targets
    data = null // add in data from submit buttons or stuff
    presets = null
    config = null
    constructor({
        history,
        debug,
        dispatch,
        method,
        url,
        form,
        selection,
        identifier,
        loading,
        error,
        disable,
        data,
        config,
        presets
    }) {
        if (history === 'on') {
            window.addEventListener('popstate', () => {
                location.reload();
            });
        }

        if (this.validate({
            config: {
                type: 'object',
                value: config,
                // instance: HTMLElement not available in node
            }
        }, true)) this.config = config

        if (this.validate({
            debug: {
                type: 'string',
                value: debug,
                options: [
                    'on',
                    'off'
                ]
            }
        }, true)) {
            if (debug == 'on') this.debug = true
        }

        if (this.validate({
            presets: {
                type: 'string',
                value: presets
            }
        })) this.presets = presets.split(' ');

        if (this.presets != null && this.presets.length > 0 && this.config?.presets && Object.keys(this.config.presets).length > 0) {
            if (selection == null) {
                selection = ''
            }
            let selections = selection.split(' ');
            this.presets.forEach(preset => {
                if (this.config.presets[preset] ?? false) {
                    selections.push(this.config.presets[preset])
                }
            });
            selection = selections.filter(item => item != '').join(' ')
        }

        if (this.validate({
            selection: {
                type: 'string',
                value: selection
            }
        })) this.selection = selection

        if (this.validate({
            url: {
                type: 'string',
                value: url
            }
        })) this.url = url

        if (this.validate({
            identifier: {
                type: 'string',
                value: identifier
            }
        }, true)) this.identifier = identifier

        if (this.validate({
            loading: {
                type: 'string',
                value: loading
            }
        }, true)) this.loading = loading

        if (this.validate({
            disable: {
                type: 'string',
                value: disable
            }
        }, true)) this.disable = disable

        if (this.validate({
            error: {
                type: 'string',
                value: error
            }
        }, true)) this.error = error

        if (this.validate({
            form: {
                type: 'object',
                value: form,
                // instance: HTMLElement not available in node
            }
        }, true)) this.form = form

        if (this.validate({
            history: {
                type: 'string',
                value: history,
                options: [
                    'on',
                    'off'
                ]
            }
        }, true)) {
            if (history == 'on') this.history = true
        }

        if (this.validate({
            dispatch: {
                type: 'string',
                value: dispatch,
                options: [
                    'on',
                    'off'
                ]
            }
        }, true)) {
            if (dispatch == 'on') this.dispatch = true
        }

        if (this.validate({
            method: {
                type: 'string',
                value: method,
                options: [
                    'get',
                    'put',
                    'post'
                ]
            }
        }, true)) {
            this.method = method
        }

        this.data = data ?? null
    }

    fixQueryString(url) {
        try {
            const raw = String(url ?? '');
            const normalized = raw.replace(/&amp;/g, '&');
            const u = new URL(normalized, window.location.href);
            return u.toString();
        } catch (e) {
            __recyclrDebugLog(this, 'fixQueryString fallback', e);
            return url;
        }
    }

    async request() {
        __recyclrDebugLog(this, 'request')
        // How will we determine the request method?
        // gx-get? gx-method? something else?
        /**
         *
         * Essentially, we'll load these gx attributes onto the trigger, which may be a form element, or just an element that has some inputs, or something else
         *
         * Some kind of event will trigger the gx-controller to use the GX class to make a request, parse the mapping, and evaluate it
         *
         * Examples:
         *
         * A button is clicked, and it updates a few locations on the page
         *
         * A form is submitted, and it updates a few locations on the page
         *
         * An api URL is being polled and will trigger the gx-controller to update the page because a certain event has occurred in the background
         *
         * A button is clicked, and we want to open a modal
         *
         * The nav is opened, a nav button is clicked, and we want to open a modal
         *
         * Different classes or controllers are added to an element, but the content of that element is untouched
         *
         *
         * Concept:
         *
         * We'll want to be able to get the data from the sourceElement of the event, then we'll use that data, make a javascript request, and update certain locations on the page
         *
         * We may want to study more HTMX to see any edge-cases I'm missing, but I think I've got all I need covered here
         *
         * I want to make one single request, and update multiple locations, being as efficient as possible
         *
         * I also want to handle redirects from the server if needed, preserving the from location and the intent, so that we can navigate back, like if logged out
         *
         * I also want to use this for polling for events and random encounters
         *
         * Potential Solutions:
         *
         * I may do a gx-get, gx-put, gx-post, gx-patch, gx-all, etc, and grab which-ever is needed based on the given method during the handler, so that if I trigger it from something else, I can determine what actions is handled for each case
         * This might not be necessary though
         * I may just do gx-method, gx-route, gx-select
         *
         * I'll also want to do something like how hx-disable, hx-loading, etc, just selectors and attributes to use on the page
         *
         */
        __recyclrDebugLog(this, 'show loading here...')
        if (this.loading) {
            this.handleShowSpinner()
        }
        let valid = this.validate({
            // form: {
            // type:'object',
            // value:this.form
            // },
            url: {
                type: 'string',
                value: this.url
            },
            selection: {
                type: 'string',
                value: this.selection
            },
            method: {
                type: 'string',
                value: this.method
            },
        })
        if (!valid) {
            throw new Error('Missing requirements to make a request...')
            return false
        }

        // From here we need to:
        // disable all disable targets
        // show the loading target
        // hide all relevant event targets

        this.url = this.fixQueryString(this.url)

        try {


            let requestBody = {
                // headers: {
                // "Content-Type": "application/x-www-form-urlencoded",
                // "Content-Type": "multipart/form-data",
                // },
            }

            requestBody.method = this.method.toUpperCase()
            if (this.form !== null) {
                let formData = new FormData(this.form)
                if (this.data !== null) {
                    let keys = Object.keys(this.data)
                    keys.forEach(key => {
                        formData.append(key, this.data[key]);
                    })
                }
                switch (this.method) {
                    case 'put':
                    case 'post':
                        requestBody.body = formData
                        break
                    case 'get':
                        const queryString = new URLSearchParams(formData).toString();
                        this.url += `?${queryString}`
                        this.url = this.fixQueryString(this.url)
                        break;
                    default:
                        console.error(`No actionable case...`)
                        break
                }
            }
            let condition = null
            let target = await applyBusyState(this?.target || document, true);
            let response = await fetch(this.url, requestBody).then(response => {
                __recyclrDebugLog(this, 'here we need to figure out what the response was')
                __recyclrDebugLog(this, 'Status code:', response.status);
                __recyclrDebugLog(this, 'selection:')
                __recyclrDebugLog(this, this.selection)
                if (response.redirected) {
                    __recyclrDebugLog(this, 'this has been redirected')
                    condition = 'redirect'
                }
                if (!response.ok) {
                    condition = 'error'
                    // new Error('Network response was not ok ' + response.statusText);
                    console.error('There was a problem with the fetch operation');
                }
                this.url = response.url
                return response; // Get the response as text (HTML)
            })
            let html = await response.text()
            let res = response

            __recyclrDebugLog(this, 'hide loading here...')
            valid = this.validate({
                html: {
                    type: 'string',
                    value: html
                },
                selection: {
                    type: 'string',
                    value: this.selection
                }
            })

            if (!valid) {
                throw new Error('Missing requirements to evaluate the response ...')
                return false
            }

            // console.log('evaluating...')
            const events = await this.evaluateWithPresets(res, html, this.selection, condition)
            // console.log('evaluated...')

            if (events.length <= 0) {
                throw new Error(`No changes were returned... Selection:${this.selection}`)
            }

            // __recyclrDebugLog(this, 'rendering...');
            this.render(events)
            // console.log('rendered...')
            // From here we need to:
            // enable all disable targets
            // hide the loading target
            // show all relevant event targets
            // update the history
            if (this.history) {
                history.pushState(null, 'Page Title', this.url);
            }

        } catch (err) {
            console.error('An error has occurred while processing this request...')
            console.error(err)
            // From here we need to:
            // enable all disable targets
            // hide the loading target(s)
            // show all relevant event targets
            // show the error target

        }
        if (this.loading) {
            this.handleHideSpinner()
        }
    }
    handleShowSpinner() {
        __recyclrDebugLog(this, 'showing spinner')
        __recyclrDebugLog(this, this.loading)
        let spinner = document.querySelector(this.loading)
        if (spinner) {
            spinner.style.display = 'block'
        }
    }

    handleHideSpinner() {
        __recyclrDebugLog(this, 'hiding spinner')
        __recyclrDebugLog(this, this.loading)
        let spinner = document.querySelector(this.loading)
        if (spinner) {
            spinner.style.display = 'none'
        }
    }

    render(events) {
        // console.log('rendering')
        // Parse through the events, they'll have multiple properties, we'll document.querySelector the target, and place in the new value
        // events [] = target { selector, location, selection }
        // console.log(events)
        events.forEach(event => {
            let { selector, location, selection } = event

            let target = document.querySelector(selector)
            if (target == null) { __recyclrDebugLog(this, 'render: missing target', selection); return; }
            switch (location) {
                case 'innerHTML':
                case 'outerHTML':
                    target[location] = selection
                    break;
                case 'beforebegin':
                case 'afterbegin':
                case 'beforeend':
                case 'afterend':
                    target.insertAdjacentHTML(location, selection)
                    break;
                default:
                    throw new Error(`Invalid location provided... Location:${location}; Selector:${selector}`)
                    break;
            }

            if (this.dispatch && this.validate({
                identifier: {
                    type: 'string',
                    value: this.identifier
                }
            }, true)) {



                this.handleDispatch(this._lastEventName || 'updated', { target: target, bubbles: true })
            }
        })
    }

    async evaluateWithPresets(res, html, selection, condition) {
        try {
            // Load presets from config or external file once
            if (!this._presetsLoaded) {
                this._presetsLoaded = true;
                this._presetsConfig = this.config?.presets || null;
                if (!this._presetsConfig && this.config?.presetsUrl) {
                    this._presetsConfig = await __recyclrLoadPresetsExternal(this.config.presetsUrl);
                }
            }

            // Decide which presets to use
            let names = [];
            const hNames = res?.headers?.get?.('Recyclr-Use-Presets');
            if (hNames) names = hNames.split(/[;,]/).map(s => s.trim()).filter(Boolean);

            // Triggers by redirect / status
            try {
                if (names.length === 0 && this._presetsConfig?.triggers) {
                    const t = this._presetsConfig.triggers;
                    if (res?.redirected && Array.isArray(t.redirect)) names = t.redirect.slice();
                    if (res?.status && t['status:' + res.status]) names = t['status:' + res.status].slice();
                }
            } catch (_) { }

            // If none requested, just do normal path
            if (!this._presetsConfig || names.length === 0) {
                return this.evaluate(html, selection, condition);
            }

            // Gather rules for the chosen names
            const all = this._presetsConfig.presets || {};
            let rules = [];
            names.forEach(n => {
                const spec = all[n];
                if (!spec) return;
                if (Array.isArray(spec)) {
                    spec.forEach(s => rules.push(typeof s === 'string' ? __recyclrParseRule(s) : s));
                } else if (typeof spec === 'string') {
                    rules.push(__recyclrParseRule(spec));
                } else if (typeof spec === 'object') {
                    rules.push(spec);
                }
            });
            rules = rules.filter(Boolean);

            // If still none, fall back
            if (rules.length === 0) {
                if (this._presetsConfig?.fallback && all[this._presetsConfig.fallback]) {
                    const fb = all[this._presetsConfig.fallback];
                    const arr = Array.isArray(fb) ? fb : [fb];
                    arr.forEach(s => rules.push(typeof s === 'string' ? __recyclrParseRule(s) : s));
                } else {
                    // Default safe fallback: body -> body
                    rules.push({ src: 'body', srcLoc: 'innerHTML', dst: 'body', dstLoc: 'innerHTML' });
                }
            }

            const events = __recyclrBuildEventsFromPresetRules.call(this, html, rules);
            if (!Array.isArray(events) || events.length === 0) {
                __recyclrDebugLog(this, 'presets produced no events; falling back to evaluate()');
                return this.evaluate(html, selection, condition);
            }

            // Keep the event name if server provided
            this._lastEventName = res?.headers?.get?.('Recyclr-Event') || 'updated';
            this._lastPresetNames = names;
            return events;
        } catch (e) {
            __recyclrDebugLog(this, 'evaluateWithPresets failed', e);
            return this.evaluate(html, selection, condition);
        }
    }

    parse(s) {
        // "[selectionSelector(@location)]->[targetSelector(@location)] ..."
        let valid = this.validate({
            s: {
                value: s,
                type: 'string'
            }
        })
        if (!valid) throw new Error('Invalid arguments given...')
        let events = s.split(' ').map(event => {

            let conditionTouple = event.split(':')
            let eventString = null
            let condition = null

            switch (conditionTouple.length) {
                case 1:
                    eventString = conditionTouple[0]
                    break;
                case 2:
                    condition = conditionTouple[0]
                    eventString = conditionTouple[1]
                    break;
                default:
                    throw new Error('Invalid event properties...')
            }


            // Parse the event
            const d = eventString.split('->').map(target => {
                let data = target.split('@')
                // Here we check to make sure data[0] does not contain the append/prepend data
                return {
                    selector: data[0],
                    location: data[1] ?? 'outerHTML'
                }
            })
            return {
                condition: condition,
                selection: d[0],
                target: d[1]
            }
        })
        // console.log(events)
        //
        // Add a check here to make sure that the selector for select isn't beforeend or something like that, since that's meaningless and should only be used for the output selector
        //
        return events
    }

    evaluate(html, select, condition = null) {
        // evaluate my parser on response html
        // render / querySelector the html in js, for each event in the parseMap, find the selection from the html, then update our targets in the dom
        // make sure all the javascript events are being added to the content
        let events = this.parse(select)

        if (events != null) {
            events = events.filter(item => {
                return item.condition == condition
            })
        }
        const doc = this.parseHTML(html)
        const selections = []
        events.forEach(event => {

            let { selection, target } = event
            if (target == null || target == undefined) target = selection

            if (target == null) { __recyclrDebugLog(this, 'render: missing target', selection); return; }
            let { selector, location } = selection

            //
            // Determine if location is looking for properties ie: [name, href, data-label]
            //
            /**
            *   If location  has a \[ [\w\W\d]+ \] then we're looking for properties
            *   I could maybe do it with split
            *   split location by [
            *   0 is the location selector
            *   1 is the properties and the end bracket joined by commas with potential spaces
            *   When this is present we have to scrap the normal behavior, and only do the updates
            *   I think we need to just do the swap, and not push it into selections
            *       We are skipping the render method
            *
            *
            */
            // console.log('creating new location... Location:' + location)
            // let L = new Location({ string: location })
            let L = new Location(location)

            // console.log('has properties')
            // console.log(L.properties())
            let properties = Array.from(L.properties() ?? [])
            // console.log(properties)
            if (properties.length) {
                let response = doc.querySelector(selector)
                // Here we need to find the outputs, and load them in, then return early so it's not replaced or put into my selections
                return false;
            }

            target.selection = doc.querySelector(selector)[L.string]
            selections.push(target)
        })

        return selections
    }

    validate(o, silent = false) {
        let valid = true
        let keys = Array.from(Object.keys(o));
        keys.forEach(k => {
            let { type, value, length, instance, options } = o[k]

            if (typeof type !== 'string') {
                (!silent || this.debug) && console.error('Type was not a string...');
                valid = false
                return valid
            }
            if (typeof value !== type) {
                (!silent || this.debug) && console.error(`Invalid value for ${k} given... expected ${type}...`)
                valid = false
                return valid
            }
            if (instance && !(value instanceof instance)) {
                (!silent || this.debug) && console.error(`Invalid value for ${k} given... expected instance of ${JSON.stringify(instance)}...`)
                valid = false
                return valid
            }
            if (options && !(options.includes(value))) {
                (!silent || this.debug) && console.error(`Invalid value for ${k} given... Value: ${JSON.stringify(value)} not in ${JSON.stringify(options)}...`)
                valid = false
                return valid
            }

        });

        return valid;
    }


    parseHTML(resp) {
        const parser = new DOMParser()
        return parser.parseFromString(resp, 'text/html')
    }

    handleDispatch(eventName, params = {}) {
        const fullEventName = `${this.identifier}:${eventName}`;

        const { bubbles, cancelable, composed } = params

        const target = params.target ?? document

        const event = new CustomEvent(fullEventName, {
            detail: { ...params }, bubbles: bubbles ?? true,
            cancelable: cancelable ?? true,
            composed: composed ?? true,
        });

        return target.dispatchEvent(event);

    }
    test() {
        __recyclrDebugLog(this, 'Running GX tests...')
        let tests = {
            validate: () => {
                let valid = this.validate({
                    foo: {
                        type: 'string',
                        value: 'bar'
                    }
                })
                if (!valid) console.error('Could not validate...')

                valid = this.validate({
                    foo: {
                        type: 'number',
                        value: 1
                    }
                })
                if (!valid) console.error('Could not validate...')
            },
            notValidate: () => {
                let valid = this.validate({
                    foo: {
                        type: 'number',
                        value: 'bar'
                    }
                })
                if (valid) console.error('Could validate, but shouldn\'t...')

                valid = this.validate({
                    foo: {
                        type: 'number',
                        value: '1'
                    }
                })
                if (valid) console.error('Could validate, but shouldn\'t...')

                valid = this.validate({
                    foo: {
                        type: 'string',
                        value: 1
                    }
                })
                if (valid) console.error('Could validate, but shouldn\'t...')
            },
            parse: () => {
                // 'selectionSelector@location->targetSelector@location%swap' ?
                // 'selectionSelector@location->targetSelector@location%append' ?
                // Actually, we don't need this
                //
                // 'selectionSelector@location->targetSelector@beforeend' (append)
                // 'selectionSelector@location->targetSelector@afterbegin (append)
                // 'selectionSelector@location->targetSelector@outerHTML (swap)
                // 'selectionSelector@location->targetSelector@innerHTML (swap)
                let events = this.parse('selectionSelector@location->targetSelector@location')
                let valid = events.length > 0
                if (!valid) console.error('Could not validate...')

                __recyclrDebugLog(this, JSON.stringify(events))

                events = this.parse('selectionSelector@location->targetSelector@location selectionSelector@location->targetSelector@location')
                valid = (events.length === 2)
                if (!valid) console.error('Could not validate...')

                events = this.parse('selectionSelector->targetSelector')

                __recyclrDebugLog(this, JSON.stringify(events))

                valid = events.length > 0
                if (!valid) console.error('Could not validate...')
            },
            parseProps: () => {
                let events = this.parse('selectionSelector@[name]->targetSelector@location')
                let valid = events.length > 0
                if (!valid) console.error('Could not validate...')
                __recyclrDebugLog(this, JSON.stringify(events))
                let event = events[0]
                let { selection } = event
                let { location } = selection
                __recyclrDebugLog(this, 'creating new location... Location:' + location)
                __recyclrDebugLog(this, 'this one might be wrong, since it is not being passed an object')
                let L = new Location(location)
                __recyclrDebugLog(this, L.properties())
            },
            parseManyProps: () => {
                let events = this.parse('selectionSelector@[name,width,src,dataSocket]->targetSelector@location')
                let valid = events.length > 0
                if (!valid) console.error('Could not validate...')
                __recyclrDebugLog(this, JSON.stringify(events))
                let event = events[0]
                let { selection } = event
                let { location } = selection
                __recyclrDebugLog(this, 'creating new location... Location:' + location)
                __recyclrDebugLog(this, 'this one might be wrong, since it is not being passed an object')
                let L = new Location(location)
                __recyclrDebugLog(this, L.properties())
            }
        }

        Array.from(Object.keys(tests)).forEach(t => {
            __recyclrDebugLog(this, `Running ${t} test...`)
            tests[t]()
            __recyclrDebugLog(this, `${t} test completed...`)
        })
    }
}

class Location {

    string = ""

    constructor(s) {

        let valid = this.validate({
            s: {
                type: 'string',
                value: s
            }
        })
        if (!valid) throw new Error('Could not validate...')
        // console.log('new location: ')
        // console.log(s)
        this.string = s
    }

    evaluate() {

    }

    properties() {

        let valid = this.validate({
            s: {
                type: 'string',
                value: this.string
            }
        })
        if (!valid) throw new Error('Could not validate this.string...')

        // console.log('properties... splitting this.string')
        // console.log(this.string)
        let location = this.string.split('[')
        if (location[1]) {
            // We are going to have to find the taret and the selection, then grab the properties and update the target from the selection
            let properties = location[1].split(']')
            properties = properties[0]
            properties = properties.split(',')
            return properties
        }
        return [];
    }

    selector() {

        let valid = this.validate({
            s: {
                type: 'string',
                value: this.string
            }
        })
        if (!valid) throw new Error('Could not validate this.string...')
        // console.log('selector... splitting this.string')
        // console.log(this.string)
        return this.string.split('[')[0]
    }

    validate(o, silent = false) {
        let valid = true
        let keys = Array.from(Object.keys(o));
        keys.forEach(k => {
            let { type, value, length, instance, options } = o[k]

            if (typeof type !== 'string') {
                (!silent || this.debug) && console.error('Type was not a string...');
                valid = false
                return valid
            }
            if (typeof value !== type) {
                (!silent || this.debug) && console.error(`Invalid value for ${k} given... expected ${type}...`)
                valid = false
                return valid
            }
            if (instance && !(value instanceof instance)) {
                (!silent || this.debug) && console.error(`Invalid value for ${k} given... expected instance of ${JSON.stringify(instance)}...`)
                valid = false
                return valid
            }
            if (options && !(options.includes(value))) {
                (!silent || this.debug) && console.error(`Invalid value for ${k} given... Value: ${JSON.stringify(value)} not in ${JSON.stringify(options)}...`)
                valid = false
                return valid
            }

        });

        return valid;
    }


}

module.exports = GX


// --- recyclr: busy/disable helpers ---
function applyBusyState(root, busy) {
    try {
        let el = root;
        if (!(el instanceof Element)) {
            el = typeof root === 'string' ? document.querySelector(root) : null;
        }
        if (!el) return;
        if (busy) {
            el.setAttribute('aria-busy', 'true');
            el.setAttribute('inert', '');
        } else {
            el.removeAttribute('aria-busy');
            el.removeAttribute('inert');
        }
        const focusables = el.querySelectorAll('button, [role="button"], input, select, textarea, [tabindex]');
        focusables.forEach(node => {
            if (busy) {
                node.setAttribute('data-recyclr-prev-disabled', node.disabled ? '1' : '0');
                node.disabled = true;
                node.setAttribute('aria-disabled', 'true');
            } else {
                const prev = node.getAttribute('data-recyclr-prev-disabled');
                if (prev === '0') {
                    node.disabled = false;
                    node.removeAttribute('aria-disabled');
                }
                node.removeAttribute('data-recyclr-prev-disabled');
            }
        });
    } catch (e) {
        __recyclrDebugLog(this, 'applyBusyState error', e);
    }
}
// --- end busy/disable helpers ---
