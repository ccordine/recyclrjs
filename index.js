

export default class GX {

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
    data
  }) {

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
  async request() {
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
      throw console.error('Missing requirements to make a request...')
      return false
    }

    // From here we need to:
    // disable all disable targets
    // show the loading target
    // hide all relevant event targets

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
            break;
          default:
            console.error(`No actionable case...`)
            break
        }
      }
      let html = await fetch(this.url, requestBody).then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.text(); // Get the response as text (HTML)
      }).catch(error => {
        throw console.error('There was a problem with the fetch operation:', error);
      });
      // console.log('html start')
      // console.log(html)
      // console.log('html end')
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
        throw console.error('Missing requirements to evaluate the response ...')
        return false
      }

      // console.log('evaluating...')
      const events = this.evaluate(html, this.selection)
      // console.log('evaluated...')

      if (events.length <= 0) {
        throw console.error(`No changes were returned... Selection:${this.selection}`)
      }

      // console.log('rendering...');
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
  }

  render(events) {
    // console.log('rendering')
    // Parse through the events, they'll have multiple properties, we'll document.querySelector the target, and place in the new value
    // events [] = target { selector, location, selection }
    // console.log(events)
    events.forEach(event => {
      let { selector, location, selection } = event

      let target = document.querySelector(selector)
      if (target == null || target == undefined) {
        throw console.error('Could not find target for selector: ' + selector + '...')
      }
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
          throw console.error(`Invalid location provided... Location:${location}; Selector:${selector}`)
          break;
      }

      if (this.dispatch && this.validate({
        identifier: {
          type: 'string',
          value: this.identifier
        }
      }, true)) {
        this.handleDispatch('updated', { target: target, bubbles: true })
      }
    })
  }

  parse(s) {
    // "[selectionSelector(@location)]->[targetSelector(@location)] ..."
    let valid = this.validate({
      s: {
        value: s,
        type: 'string'
      }
    })
    if (!valid) throw console.error('Invalid arguments given...')
    let events = s.split(' ').map(event => {
      // Parse the event
      const d = event.split('->').map(target => {
        let data = target.split('@')
        return {
          selector: data[0],
          location: data[1] ?? 'outerHTML'
        }
      })
      return {
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

  evaluate(html, select) {
    // evaluate my parser on response html
    // render / querySelector the html in js, for each event in the parseMap, find the selection from the html, then update our targets in the dom
    // make sure all the javascript events are being added to the content
    const events = this.parse(select)
    const doc = this.parseHTML(html)
    const selections = []
    events.forEach(event => {

      let { selection, target } = event
      if (target == null || target == undefined) target = selection

      if (target == null || target == undefined) {
        throw console.error('Could not find target for event: ' + JSON.stringify(event) + '...')
      }
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

    const target = params.target

    const event = new CustomEvent(fullEventName, {
      detail: { ...params },
      target: target,
      currentTarget: target,
      bubbles: bubbles ?? true,
      cancelable: cancelable ?? true,
      composed: composed ?? true,
    });

    return target.dispatchEvent(event);

  }
  test() {
    console.log('Running GX tests...')
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

        console.log(JSON.stringify(events))

        events = this.parse('selectionSelector@location->targetSelector@location selectionSelector@location->targetSelector@location')
        valid = events.length = 2
        if (!valid) console.error('Could not validate...')

        events = this.parse('selectionSelector->targetSelector')

        console.log(JSON.stringify(events))

        valid = events.length > 0
        if (!valid) console.error('Could not validate...')
      },
      parseProps: () => {
        let events = this.parse('selectionSelector@[name]->targetSelector@location')
        let valid = events.length > 0
        if (!valid) console.error('Could not validate...')
        console.log(JSON.stringify(events))
        let event = events[0]
        let { selection } = event
        let { location } = selection
        console.log('creating new location... Location:' + location)
        console.log('this one might be wrong, since it is not being passed an object')
        let L = new Location(location)
        console.log(L.properties())
      },
      parseManyProps: () => {
        let events = this.parse('selectionSelector@[name,width,src,dataSocket]->targetSelector@location')
        let valid = events.length > 0
        if (!valid) console.error('Could not validate...')
        console.log(JSON.stringify(events))
        let event = events[0]
        let { selection } = event
        let { location } = selection
        console.log('creating new location... Location:' + location)
        console.log('this one might be wrong, since it is not being passed an object')
        let L = new Location(location)
        console.log(L.properties())
      }
    }

    Array.from(Object.keys(tests)).forEach(t => {
      console.log(`Running ${t} test...`)
      tests[t]()
      console.log(`${t} test completed...`)
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
    if (!valid) throw console.error('Could not validate...')
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
    if (!valid) throw console.error('Could not validate this.string...')

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
    if (!valid) throw console.error('Could not validate this.string...')
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

// module.exports = GX
