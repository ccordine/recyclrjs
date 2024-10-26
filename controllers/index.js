// const GX = document.require("../index.js")
// console.log( new GX({}))
// console.log("Hello!")
// 

class GXController {

  connection = null
  keys = [
      'history',
      'debug',
      'dispatch',
      'method',
      'url',
      'form',
      'selection',
      'identifier',
      'loading',
      'error',
      'disable',
      'data'
  ]
  createGX(data = {}) {
    let d = {}
    this.keys.forEach(key => {
      d[key] = data[key] ?? null
    })
    return new GX(d)
  }

  generate(event) {
    console.log("generate")
    console.log(event)
    if(!event) {
      return console.error("no event found")
    }

    const {currentTarget}= event
    return new GXHelper(currentTarget)
  }
  debug(){
    console.log("debug")
  }

 setup() {
    console.log('recyclr setup')
    const actions = ["click"]
    const a = {
      "click": this.generate
    }
    actions.forEach(action => {
      console.log(action)
      let elements = document.querySelectorAll(`[recyclr=${action}]`)
      console.log(elements)
      Array.from(elements).forEach(element => {
          console.log(element)
          console.log(a[action])
        // console.log(element.addEventListener)
          // element[`on${action}`] = a[action]
          element.addEventListener(action, a[action])
      });
    });

  }
}


class GXHelper {
    constructor(element) {
        let {
            gxSelect, // *
            gxUrl, // *
            gxMethod,
            gxHistory,
            gxDebug,
            gxForm,
            // gxDispatch,
            // gxIdentifier,
            gxLoading,
            gxError,
            gxDisable
        } = element.dataset

        let { href, action, method, name, value } = element
        let form = null
        if (gxForm !== null) form = document.querySelector(gxForm)
        if (form == null && element.tagName == 'FORM') form = element
        console.log('gxForm:' + JSON.stringify(gxForm))
        console.log('Form:' + JSON.stringify(form))
        console.log('Element Tag:' + element.tagName)
        let data = null
        if (name !== null && value !== null) {
            data = {}
            data[name] = value
        }
        const gx = new GX({
            method: gxMethod ?? method ?? 'get',
            url: gxUrl ?? href ?? action,
            debug: gxDebug ?? false,
            // dispatch: gxDispatch,
            dispatch: 'on',
            form: form,
            selection: gxSelect,
            // identifier: gxIdentifier,
            identifier: 'gx',
            loading: gxLoading ?? null,
            error: gxError ?? null,
            disable: gxDisable ?? null,
            history: gxHistory ?? 'on',
            data: data
        })
        gx.request()
    }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Connected...')

const recyclr = new GXController()
  recyclr.setup()
})
