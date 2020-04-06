/* eslint-env browser, jquery */
/* global moment, serverurl, plantumlServer, L */

import Prism from 'prismjs'
import hljs from 'highlight.js'
import PDFObject from 'pdfobject'
import { saveAs } from 'file-saver'

import escapeHTML from 'lodash/escape'
import unescapeHTML from 'lodash/unescape'

import isURL from 'validator/lib/isURL'

import { stripTags } from '../../utils/string'

import getUIElements from './lib/editor/ui-elements'
import { emojifyImageDir } from './lib/editor/constants'

import markdownit from 'markdown-it'
import markdownitContainer from 'markdown-it-container'

/* Defined regex markdown it plugins */
import Plugin from 'markdown-it-regexp'

require('prismjs/themes/prism.css')
require('prismjs/components/prism-wiki')
require('prismjs/components/prism-haskell')
require('prismjs/components/prism-go')
require('prismjs/components/prism-typescript')
require('prismjs/components/prism-jsx')
require('prismjs/components/prism-makefile')
require('prismjs/components/prism-gherkin')

require('./lib/common/login')
require('../vendor/md-toc')
let viz = new window.Viz()
const plantumlEncoder = require('plantuml-encoder')

const ui = getUIElements()

// auto update last change
window.createtime = null
window.lastchangetime = null
window.lastchangeui = {
  status: $('.ui-status-lastchange'),
  time: $('.ui-lastchange'),
  user: $('.ui-lastchangeuser'),
  nouser: $('.ui-no-lastchangeuser')
}

const ownerui = $('.ui-owner')

export function updateLastChange () {
  if (!window.lastchangeui) return
  if (window.createtime) {
    if (window.createtime && !window.lastchangetime) {
      window.lastchangeui.status.text('created')
    } else {
      window.lastchangeui.status.text('changed')
    }
    const time = window.lastchangetime || window.createtime
    window.lastchangeui.time.html(moment(time).fromNow())
    window.lastchangeui.time.attr('title', moment(time).format('llll'))
  }
}
setInterval(updateLastChange, 60000)

window.lastchangeuser = null
window.lastchangeuserprofile = null

export function updateLastChangeUser () {
  if (window.lastchangeui) {
    if (window.lastchangeuser && window.lastchangeuserprofile) {
      const icon = window.lastchangeui.user.children('i')
      icon.attr('title', window.lastchangeuserprofile.name).tooltip('fixTitle')
      if (window.lastchangeuserprofile.photo) { icon.attr('style', `background-image:url(${window.lastchangeuserprofile.photo})`) }
      window.lastchangeui.user.show()
      window.lastchangeui.nouser.hide()
    } else {
      window.lastchangeui.user.hide()
      window.lastchangeui.nouser.show()
    }
  }
}

window.owner = null
window.ownerprofile = null

export function updateOwner () {
  if (ownerui) {
    if (window.owner && window.ownerprofile && window.owner !== window.lastchangeuser) {
      const icon = ownerui.children('i')
      icon.attr('title', window.ownerprofile.name).tooltip('fixTitle')
      const styleString = `background-image:url(${window.ownerprofile.photo})`
      if (window.ownerprofile.photo && icon.attr('style') !== styleString) { icon.attr('style', styleString) }
      ownerui.show()
    } else {
      ownerui.hide()
    }
  }
}

// get title
function getTitle (view) {
  let title = ''
  if (md && md.meta && md.meta.title && (typeof md.meta.title === 'string' || typeof md.meta.title === 'number')) {
    title = md.meta.title
  } else {
    const h1s = view.find('h1')
    if (h1s.length > 0) {
      title = h1s.first().text()
    } else {
      title = null
    }
  }
  return title
}

// render title
export function renderTitle (view) {
  let title = getTitle(view)
  if (title) {
    title += ' - CodiMD'
  } else {
    title = 'CodiMD - Collaborative markdown notes'
  }
  return title
}

// render filename
export function renderFilename (view) {
  let filename = getTitle(view)
  if (!filename) {
    filename = 'Untitled'
  }
  return filename
}

// render tags
export function renderTags (view) {
  const tags = []
  const rawtags = []
  if (md && md.meta && md.meta.tags && (typeof md.meta.tags === 'string' || typeof md.meta.tags === 'number')) {
    const metaTags = (`${md.meta.tags}`).split(',')
    for (let i = 0; i < metaTags.length; i++) {
      const text = metaTags[i].trim()
      if (text) rawtags.push(text)
    }
  } else {
    view.find('h6').each((key, value) => {
      if (/^tags/gmi.test($(value).text())) {
        const codes = $(value).find('code')
        for (let i = 0; i < codes.length; i++) {
          const text = codes[i].innerHTML.trim()
          if (text) rawtags.push(text)
        }
      }
    })
  }
  for (let i = 0; i < rawtags.length; i++) {
    let found = false
    for (let j = 0; j < tags.length; j++) {
      if (tags[j] === rawtags[i]) {
        found = true
        break
      }
    }
    if (!found) { tags.push(rawtags[i]) }
  }
  return tags
}

function slugifyWithUTF8 (text) {
  // remove HTML tags and trim spaces
  let newText = stripTags(text.toString().trim())
  // replace space between words with dashes
  newText = newText.replace(/\s+/g, '-')
  // slugify string to make it valid as an attribute
  newText = newText.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '')
  return newText
}

// parse meta
export function parseMeta (md, edit, view, toc, tocAffix) {
  let lang = null
  let dir = null
  let breaks = window.defaultUseHardbreak
  if (md && md.meta) {
    const meta = md.meta
    lang = meta.lang
    dir = meta.dir
    breaks = meta.breaks
  }
  // text language
  if (lang && typeof lang === 'string') {
    view.attr('lang', lang)
    toc.attr('lang', lang)
    tocAffix.attr('lang', lang)
    if (edit) { edit.attr('lang', lang) }
  } else {
    view.removeAttr('lang')
    toc.removeAttr('lang')
    tocAffix.removeAttr('lang')
    if (edit) { edit.removeAttr('lang', lang) }
  }
  // text direction
  if (dir && typeof dir === 'string') {
    view.attr('dir', dir)
    toc.attr('dir', dir)
    tocAffix.attr('dir', dir)
  } else {
    view.removeAttr('dir')
    toc.removeAttr('dir')
    tocAffix.removeAttr('dir')
  }
  // breaks
  if (typeof breaks === 'boolean') {
    md.options.breaks = breaks
  } else {
    md.options.breaks = window.defaultUseHardbreak
  }
}

window.viewAjaxCallback = null

// regex for extra tags
const spaceregex = /\s*/
const notinhtmltagregex = /(?![^<]*>|[^<>]*<\/)/
let coloregex = /\[color=([#|(|)|\s|,|\w]*?)\]/
coloregex = new RegExp(coloregex.source + notinhtmltagregex.source, 'g')
let nameregex = /\[name=(.*?)\]/
let timeregex = /\[time=([:|,|+|-|(|)|\s|\w]*?)\]/
const nameandtimeregex = new RegExp(nameregex.source + spaceregex.source + timeregex.source + notinhtmltagregex.source, 'g')
nameregex = new RegExp(nameregex.source + notinhtmltagregex.source, 'g')
timeregex = new RegExp(timeregex.source + notinhtmltagregex.source, 'g')

function replaceExtraTags (html) {
  html = html.replace(coloregex, '<span class="color" data-color="$1"></span>')
  html = html.replace(nameandtimeregex, '<small><i class="fa fa-user"></i> $1 <i class="fa fa-clock-o"></i> $2</small>')
  html = html.replace(nameregex, '<small><i class="fa fa-user"></i> $1</small>')
  html = html.replace(timeregex, '<small><i class="fa fa-clock-o"></i> $1</small>')
  return html
}

if (typeof window.mermaid !== 'undefined' && window.mermaid) window.mermaid.startOnLoad = false

// dynamic event or object binding here
export function finishView (view) {
  // todo list
  const lis = view.find('li.raw').removeClass('raw').sortByDepth().toArray()

  for (let li of lis) {
    let html = $(li).clone()[0].innerHTML
    const p = $(li).children('p')
    if (p.length === 1) {
      html = p.html()
      li = p[0]
    }
    html = replaceExtraTags(html)
    li.innerHTML = html
    let disabled = 'disabled'
    if (typeof editor !== 'undefined' && window.havePermission()) { disabled = '' }
    if (/^\s*\[[x ]]\s*/.test(html)) {
      li.innerHTML = html.replace(/^\s*\[ ]\s*/, `<input type="checkbox" class="task-list-item-checkbox "${disabled}><label></label>`)
        .replace(/^\s*\[x]\s*/, `<input type="checkbox" class="task-list-item-checkbox" checked ${disabled}><label></label>`)
      if (li.tagName.toLowerCase() !== 'li') {
        li.parentElement.setAttribute('class', 'task-list-item')
      } else {
        li.setAttribute('class', 'task-list-item')
      }
    }
    if (typeof editor !== 'undefined' && window.havePermission()) { $(li).find('input').change(toggleTodoEvent) }
    // color tag in list will convert it to tag icon with color
    const tagColor = $(li).closest('ul').find('.color')
    tagColor.each((key, value) => {
      $(value).addClass('fa fa-tag').css('color', $(value).attr('data-color'))
    })
  }

  // youtube
  view.find('div.youtube.raw').removeClass('raw')
    .click(function () {
      imgPlayiframe(this, '//www.youtube.com/embed/')
    })
    // vimeo
  view.find('div.vimeo.raw').removeClass('raw')
    .click(function () {
      imgPlayiframe(this, '//player.vimeo.com/video/')
    })
    .each((key, value) => {
      $.ajax({
        type: 'GET',
        url: `//vimeo.com/api/v2/video/${$(value).attr('data-videoid')}.json`,
        jsonp: 'callback',
        dataType: 'jsonp',
        success (data) {
          const thumbnailSrc = data[0].thumbnail_large
          const image = `<img src="${thumbnailSrc}" />`
          $(value).prepend(image)
          if (window.viewAjaxCallback) window.viewAjaxCallback()
        }
      })
    })
    // gist
  view.find('code[data-gist-id]').each((key, value) => {
    if ($(value).children().length === 0) { $(value).gist(window.viewAjaxCallback) }
  })
  // sequence diagram
  const sequences = view.find('div.sequence-diagram.raw').removeClass('raw')
  sequences.each((key, value) => {
    try {
      var $value = $(value)
      const $ele = $(value).parent().parent()

      const sequence = $value
      sequence.sequenceDiagram({
        theme: 'simple'
      })

      $ele.addClass('sequence-diagram')
      $value.children().unwrap().unwrap()
      const svg = $ele.find('> svg')
      svg[0].setAttribute('viewBox', `0 0 ${svg.attr('width')} ${svg.attr('height')}`)
      svg[0].setAttribute('preserveAspectRatio', 'xMidYMid meet')
    } catch (err) {
      $value.unwrap()
      $value.parent().append(`<div class="alert alert-warning">${escapeHTML(err)}</div>`)
      console.warn(err)
    }
  })
  // flowchart
  const flow = view.find('div.flow-chart.raw').removeClass('raw')
  flow.each((key, value) => {
    try {
      var $value = $(value)
      const $ele = $(value).parent().parent()

      const chart = window.flowchart.parse($value.text())
      $value.html('')
      chart.drawSVG(value, {
        'line-width': 2,
        fill: 'none',
        'font-size': '16px',
        'font-family': "'Andale Mono', monospace"
      })

      $ele.addClass('flow-chart')
      $value.children().unwrap().unwrap()
    } catch (err) {
      $value.unwrap()
      $value.parent().append(`<div class="alert alert-warning">${escapeHTML(err)}</div>`)
      console.warn(err)
    }
  })
  // graphviz
  var graphvizs = view.find('div.graphviz.raw').removeClass('raw')
  graphvizs.each(function (key, value) {
    try {
      var $value = $(value)
      var $ele = $(value).parent().parent()
      $value.unwrap()
      viz.renderString($value.text())
        .then(graphviz => {
          if (!graphviz) throw Error('viz.js output empty graph')
          $value.html(graphviz)

          $ele.addClass('graphviz')
          $value.children().unwrap()
        })
        .catch(err => {
          viz = new window.Viz()
          $value.parent().append(`<div class="alert alert-warning">${escapeHTML(err)}</div>`)
          console.warn(err)
        })
    } catch (err) {
      viz = new window.Viz()
      $value.parent().append(`<div class="alert alert-warning">${escapeHTML(err)}</div>`)
      console.warn(err)
    }
  })
  // mermaid
  const mermaids = view.find('div.mermaid.raw').removeClass('raw')
  mermaids.each((key, value) => {
    try {
      var $value = $(value)
      const $ele = $(value).closest('pre')

      window.mermaid.parse($value.text())
      $ele.addClass('mermaid')
      $ele.html($value.text())
      window.mermaid.init(undefined, $ele)
    } catch (err) {
      $value.unwrap()
      $value.parent().append(`<div class="alert alert-warning">${escapeHTML(err.str)}</div>`)
      console.warn(err)
    }
  })
  // abc.js
  const abcs = view.find('div.abc.raw').removeClass('raw')
  abcs.each((key, value) => {
    try {
      var $value = $(value)
      var $ele = $(value).parent().parent()

      window.ABCJS.renderAbc(value, $value.text())

      $ele.addClass('abc')
      $value.children().unwrap().unwrap()
      const svg = $ele.find('> svg')
      svg[0].setAttribute('viewBox', `0 0 ${svg.attr('width')} ${svg.attr('height')}`)
      svg[0].setAttribute('preserveAspectRatio', 'xMidYMid meet')
    } catch (err) {
      $value.unwrap()
      $value.parent().append(`<div class="alert alert-warning">${escapeHTML(err)}</div>`)
      console.warn(err)
    }
  })
  // vega-lite
  const vegas = view.find('div.vega.raw').removeClass('raw')
  vegas.each((key, value) => {
    try {
      var $value = $(value)
      var $ele = $(value).parent().parent()

      const specText = $value.text()

      $value.unwrap()
      window.vegaEmbed($ele[0], JSON.parse(specText), { renderer: 'svg' })
        .then(result => {
          $ele.addClass('vega')
        })
        .catch(err => {
          $ele.append(`<div class="alert alert-warning">${escapeHTML(err)}</div>`)
          console.warn(err)
        })
        .finally(() => {
          if (window.viewAjaxCallback) window.viewAjaxCallback()
        })
    } catch (err) {
      $ele.append(`<div class="alert alert-warning">${escapeHTML(err)}</div>`)
      console.warn(err)
    }
  })
  // geo map
  view.find('div.geo.raw').removeClass('raw').each(async function (key, value) {
    const $elem = $(value).parent().parent()
    const $value = $(value)
    const content = $value.text()
    $value.unwrap()

    try {
      let position, zoom
      if (content.match(/^[-\d.,\s]+$/)) {
        const [lng, lat, zoo] = content.split(',').map(parseFloat)
        zoom = zoo
        position = [lat, lng]
      } else {
        // parse value as address
        const data = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(content)}&format=json`).then(r => r.json())
        if (!data || !data.length) {
          throw new Error('Location not found')
        }
        const { lat, lon } = data[0]
        position = [lat, lon]
      }
      $elem.html(`<div class="geo-map"></div>`)
      const map = L.map($elem.find('.geo-map')[0]).setView(position, zoom || 16)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '<a href="https://www.openstreetmap.org/">OSM</a>',
        maxZoom: 18
      }).addTo(map)
      L.marker(position, {
        icon: L.icon({
          iconUrl: `${serverurl}/build/leaflet/images/marker-icon.png`,
          shadowUrl: `${serverurl}/build/leaflet/images/marker-shadow.png`
        })
      }).addTo(map)
      $elem.addClass('geo')
    } catch (err) {
      $elem.append(`<div class="alert alert-warning">${escapeHTML(err)}</div>`)
      console.warn(err)
    }
  })

  // image href new window(emoji not included)
  const images = view.find('img.raw[src]').removeClass('raw')
  images.each((key, value) => {
    // if it's already wrapped by link, then ignore
    const $value = $(value)
    $value[0].onload = e => {
      if (window.viewAjaxCallback) window.viewAjaxCallback()
    }
  })
  // blockquote
  const blockquote = view.find('blockquote.raw').removeClass('raw')
  const blockquoteP = blockquote.find('p')
  blockquoteP.each((key, value) => {
    let html = $(value).html()
    html = replaceExtraTags(html)
    $(value).html(html)
  })
  // color tag in blockquote will change its left border color
  const blockquoteColor = blockquote.find('.color')
  blockquoteColor.each((key, value) => {
    $(value).closest('blockquote').css('border-left-color', $(value).attr('data-color'))
  })
  // slideshare
  view.find('div.slideshare.raw').removeClass('raw')
    .each((key, value) => {
      $.ajax({
        type: 'GET',
        url: `//www.slideshare.net/api/oembed/2?url=http://www.slideshare.net/${$(value).attr('data-slideshareid')}&format=json`,
        jsonp: 'callback',
        dataType: 'jsonp',
        success (data) {
          const $html = $(data.html)
          const iframe = $html.closest('iframe')
          const caption = $html.closest('div')
          const inner = $('<div class="inner"></div>').append(iframe)
          const height = iframe.attr('height')
          const width = iframe.attr('width')
          const ratio = (height / width) * 100
          inner.css('padding-bottom', `${ratio}%`)
          $(value).html(inner).append(caption)
          if (window.viewAjaxCallback) window.viewAjaxCallback()
        }
      })
    })
    // speakerdeck
  view.find('div.speakerdeck.raw').removeClass('raw')
    .each((key, value) => {
      const url = `https://speakerdeck.com/${$(value).attr('data-speakerdeckid')}`
      const inner = $('<a>Speakerdeck</a>')
      inner.attr('href', url)
      inner.attr('rel', 'noopener noreferrer')
      inner.attr('target', '_blank')
      $(value).append(inner)
    })
    // pdf
  view.find('div.pdf.raw').removeClass('raw')
    .each(function (key, value) {
      const url = $(value).attr('data-pdfurl')
      const inner = $('<div></div>')
      $(this).append(inner)
      PDFObject.embed(url, inner, {
        height: '400px'
      })
    })
    // syntax highlighting
  view.find('code.raw').removeClass('raw')
    .each((key, value) => {
      const langDiv = $(value)
      if (langDiv.length > 0) {
        const reallang = langDiv[0].className.replace(/hljs|wrap/g, '').trim()
        const codeDiv = langDiv.find('.code')
        let code = ''
        if (codeDiv.length > 0) code = codeDiv.html()
        else code = langDiv.html()
        var result
        if (!reallang) {
          result = {
            value: code
          }
        } else if (reallang === 'haskell' || reallang === 'go' || reallang === 'typescript' || reallang === 'jsx' || reallang === 'gherkin') {
          code = unescapeHTML(code)
          result = {
            value: Prism.highlight(code, Prism.languages[reallang])
          }
        } else if (reallang === 'tiddlywiki' || reallang === 'mediawiki') {
          code = unescapeHTML(code)
          result = {
            value: Prism.highlight(code, Prism.languages.wiki)
          }
        } else if (reallang === 'cmake') {
          code = unescapeHTML(code)
          result = {
            value: Prism.highlight(code, Prism.languages.makefile)
          }
        } else {
          code = unescapeHTML(code)
          const languages = hljs.listLanguages()
          if (!languages.includes(reallang)) {
            result = hljs.highlightAuto(code)
          } else {
            result = hljs.highlight(reallang, code)
          }
        }
        if (codeDiv.length > 0) codeDiv.html(result.value)
        else langDiv.html(result.value)
      }
    })
    // mathjax
  const mathjaxdivs = view.find('span.mathjax.raw').removeClass('raw').toArray()
  try {
    if (mathjaxdivs.length > 1) {
      window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, mathjaxdivs])
      window.MathJax.Hub.Queue(window.viewAjaxCallback)
    } else if (mathjaxdivs.length > 0) {
      window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, mathjaxdivs[0]])
      window.MathJax.Hub.Queue(window.viewAjaxCallback)
    }
  } catch (err) {
    console.warn(err)
  }

  // register details toggle for scrollmap recalulation
  view.find('details.raw').removeClass('raw').each(function (key, val) {
    $(val).on('toggle', window.viewAjaxCallback)
  })

  // render title
  document.title = renderTitle(view)
}

// only static transform should be here
export function postProcess (code) {
  const result = $(`<div>${code}</div>`)
  // process style tags
  result.find('style').each((key, value) => {
    let html = $(value).html()
    // unescape > symbel inside the style tags
    html = html.replace(/&gt;/g, '>')
    // remove css @import to prevent XSS
    html = html.replace(/@import url\(([^)]*)\);?/gi, '')
    $(value).html(html)
  })
  // link should open in new window or tab
  // also add noopener to prevent clickjacking
  // See details: https://mathiasbynens.github.io/rel-noopener/
  result.find('a:not([href^="#"]):not([target])').attr('target', '_blank').attr('rel', 'noopener')
  // update continue line numbers
  const linenumberdivs = result.find('.gutter.linenumber').toArray()
  for (let i = 0; i < linenumberdivs.length; i++) {
    if ($(linenumberdivs[i]).hasClass('continue')) {
      const startnumber = linenumberdivs[i - 1] ? parseInt($(linenumberdivs[i - 1]).find('> span').last().attr('data-linenumber')) : 0
      $(linenumberdivs[i]).find('> span').each((key, value) => {
        $(value).attr('data-linenumber', startnumber + key + 1)
      })
    }
  }
  // show yaml meta paring error
  if (md.metaError) {
    var warning = result.find('div#meta-error')
    if (warning && warning.length > 0) {
      warning.text(md.metaError)
    } else {
      warning = $(`<div id="meta-error" class="alert alert-warning">${escapeHTML(md.metaError)}</div>`)
      result.prepend(warning)
    }
  }
  return result
}
window.postProcess = postProcess

var domevents = Object.getOwnPropertyNames(document).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(document)))).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(window))).filter(function (i) {
  return !i.indexOf('on') && (document[i] === null || typeof document[i] === 'function')
}).filter(function (elem, pos, self) {
  return self.indexOf(elem) === pos
})

export function removeDOMEvents (view) {
  for (var i = 0, l = domevents.length; i < l; i++) {
    view.find('[' + domevents[i] + ']').removeAttr(domevents[i])
  }
}
window.removeDOMEvents = removeDOMEvents

function generateCleanHTML (view) {
  const src = view.clone()
  const eles = src.find('*')
  // remove syncscroll parts
  eles.removeClass('part')
  src.find('*[class=""]').removeAttr('class')
  eles.removeAttr('data-startline data-endline')
  src.find("a[href^='#'][smoothhashscroll]").removeAttr('smoothhashscroll')
  // remove gist content
  src.find('code[data-gist-id]').children().remove()
  // disable todo list
  src.find('input.task-list-item-checkbox').attr('disabled', '')
  // replace emoji image path
  src.find('img.emoji').each((key, value) => {
    let name = $(value).attr('alt')
    name = name.substr(1)
    name = name.slice(0, name.length - 1)
    $(value).attr('src', `https://cdn.jsdelivr.net/npm/@hackmd/emojify.js@2.1.0/dist/images/basic/${name}.png`)
  })
  // replace video to iframe
  src.find('div[data-videoid]').each((key, value) => {
    const id = $(value).attr('data-videoid')
    const style = $(value).attr('style')
    let url = null
    if ($(value).hasClass('youtube')) {
      url = 'https://www.youtube.com/embed/'
    } else if ($(value).hasClass('vimeo')) {
      url = 'https://player.vimeo.com/video/'
    }
    if (url) {
      const iframe = $('<iframe frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>')
      iframe.attr('src', url + id)
      iframe.attr('style', style)
      $(value).html(iframe)
    }
  })
  return src
}

export function exportToRawHTML (view) {
  const filename = `${renderFilename(ui.area.markdown)}.html`
  const src = generateCleanHTML(view)
  $(src).find('a.anchor').remove()
  const html = src[0].outerHTML
  const blob = new Blob([html], {
    type: 'text/html;charset=utf-8'
  })
  saveAs(blob, filename, true)
}

// extract markdown body to html and compile to template
export function exportToHTML (view) {
  const title = renderTitle(ui.area.markdown)
  const filename = `${renderFilename(ui.area.markdown)}.html`
  const src = generateCleanHTML(view)
  // generate toc
  const toc = $('#ui-toc').clone()
  toc.find('*').removeClass('active').find("a[href^='#'][smoothhashscroll]").removeAttr('smoothhashscroll')
  const tocAffix = $('#ui-toc-affix').clone()
  tocAffix.find('*').removeClass('active').find("a[href^='#'][smoothhashscroll]").removeAttr('smoothhashscroll')
  // generate html via template
  $.get(`${serverurl}/build/html.min.css`, css => {
    $.get(`${serverurl}/views/html.hbs`, data => {
      const template = window.Handlebars.compile(data)
      const context = {
        url: serverurl,
        title,
        css,
        html: src[0].outerHTML,
        'ui-toc': toc.html(),
        'ui-toc-affix': tocAffix.html(),
        lang: (md && md.meta && md.meta.lang) ? `lang="${md.meta.lang}"` : null,
        dir: (md && md.meta && md.meta.dir) ? `dir="${md.meta.dir}"` : null
      }
      const html = template(context)
      //        console.log(html);
      const blob = new Blob([html], {
        type: 'text/html;charset=utf-8'
      })
      saveAs(blob, filename, true)
    })
  })
}

// jQuery sortByDepth
$.fn.sortByDepth = function () {
  const ar = this.map(function () {
    return {
      length: $(this).parents().length,
      elt: this
    }
  }).get()

  const result = []
  let i = ar.length
  ar.sort((a, b) => a.length - b.length)
  while (i--) {
    result.push(ar[i].elt)
  }
  return $(result)
}

function toggleTodoEvent (e) {
  const startline = $(this).closest('li').attr('data-startline') - 1
  const line = window.editor.getLine(startline)
  const matches = line.match(/^[>\s-]*[-+*]\s\[([x ])\]/)
  if (matches && matches.length >= 2) {
    let checked = null
    if (matches[1] === 'x') { checked = true } else if (matches[1] === ' ') { checked = false }
    const replacements = matches[0].match(/(^[>\s-]*[-+*]\s\[)([x ])(\])/)
    window.editor.replaceRange(checked ? ' ' : 'x', {
      line: startline,
      ch: replacements[1].length
    }, {
      line: startline,
      ch: replacements[1].length + 1
    }, '+input')
  }
}

// remove hash
function removeHash () {
  history.pushState('', document.title, window.location.pathname + window.location.search)
}

let tocExpand = false

function checkExpandToggle () {
  const toc = $('.ui-toc-dropdown .toc')
  const toggle = $('.expand-toggle')
  if (!tocExpand) {
    toc.removeClass('expand')
    toggle.text('Expand all')
  } else {
    toc.addClass('expand')
    toggle.text('Collapse all')
  }
}

// toc
export function generateToc (id) {
  const target = $(`#${id}`)
  target.html('')
  /* eslint-disable no-unused-vars */
  var toc = new window.Toc('doc', {
    level: 3,
    top: -1,
    class: 'toc',
    ulClass: 'nav',
    targetId: id,
    process: getHeaderContent
  })
  /* eslint-enable no-unused-vars */
  if (target.text() === 'undefined') { target.html('') }
  const tocMenu = $('<div class="toc-menu"></div')
  const toggle = $('<a class="expand-toggle" href="#">Expand all</a>')
  const backtotop = $('<a class="back-to-top" href="#">Back to top</a>')
  const gotobottom = $('<a class="go-to-bottom" href="#">Go to bottom</a>')
  checkExpandToggle()
  toggle.click(e => {
    e.preventDefault()
    e.stopPropagation()
    tocExpand = !tocExpand
    checkExpandToggle()
  })
  backtotop.click(e => {
    e.preventDefault()
    e.stopPropagation()
    if (window.scrollToTop) { window.scrollToTop() }
    removeHash()
  })
  gotobottom.click(e => {
    e.preventDefault()
    e.stopPropagation()
    if (window.scrollToBottom) { window.scrollToBottom() }
    removeHash()
  })
  tocMenu.append(toggle).append(backtotop).append(gotobottom)
  target.append(tocMenu)
}

// smooth all hash trigger scrolling
export function smoothHashScroll () {
  const hashElements = $("a[href^='#']:not([smoothhashscroll])").toArray()

  for (const element of hashElements) {
    const $element = $(element)
    const hash = element.hash
    if (hash) {
      $element.on('click', function (e) {
        // store hash
        const hash = decodeURIComponent(this.hash)
        // escape special characters in jquery selector
        const $hash = $(hash.replace(/(:|\.|\[|\]|,)/g, '\\$1'))
        // return if no element been selected
        if ($hash.length <= 0) return
        // prevent default anchor click behavior
        e.preventDefault()
        // animate
        $('body, html').stop(true, true).animate({
          scrollTop: $hash.offset().top
        }, 100, 'linear', () => {
          // when done, add hash to url
          // (default click behaviour)
          window.location.hash = hash
        })
      })
      $element.attr('smoothhashscroll', '')
    }
  }
}

function imgPlayiframe (element, src) {
  if (!$(element).attr('data-videoid')) return
  const iframe = $("<iframe frameborder='0' webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>")
  $(iframe).attr('src', `${src + $(element).attr('data-videoid')}?autoplay=1`)
  $(element).find('img').css('visibility', 'hidden')
  $(element).append(iframe)
}

const anchorForId = id => {
  const anchor = document.createElement('a')
  anchor.className = 'anchor hidden-xs'
  anchor.href = `#${id}`
  anchor.innerHTML = '<i class="fa fa-link"></i>'
  anchor.title = id
  return anchor
}

const createHeaderId = (headerContent, headerIds = null) => {
  // to escape characters not allow in css and humanize
  const slug = slugifyWithUTF8(headerContent)
  let id
  if (window.linkifyHeaderStyle === 'keep-case') {
    id = slug
  } else if (window.linkifyHeaderStyle === 'lower-case') {
    // to make compatible with GitHub, GitLab, Pandoc and many more
    id = slug.toLowerCase()
  } else if (window.linkifyHeaderStyle === 'gfm') {
    // see GitHub implementation reference:
    // https://gist.github.com/asabaylus/3071099#gistcomment-1593627
    // it works like 'lower-case', but ...
    const idBase = slug.toLowerCase()
    id = idBase
    if (headerIds !== null) {
      // ... making sure the id is unique
      let i = 1
      while (headerIds.has(id)) {
        id = idBase + '-' + i
        i++
      }
      headerIds.add(id)
    }
  } else {
    throw new Error('Unknown linkifyHeaderStyle value "' + window.linkifyHeaderStyle + '"')
  }
  return id
}

const linkifyAnchors = (level, containingElement) => {
  const headers = containingElement.getElementsByTagName(`h${level}`)

  for (let i = 0, l = headers.length; i < l; i++) {
    const header = headers[i]
    if (header.getElementsByClassName('anchor').length === 0) {
      if (typeof header.id === 'undefined' || header.id === '') {
        header.id = createHeaderId(getHeaderContent(header))
      }
      if (!(typeof header.id === 'undefined' || header.id === '')) {
        header.insertBefore(anchorForId(header.id), header.firstChild)
      }
    }
  }
}

export function autoLinkify (view) {
  const contentBlock = view[0]
  if (!contentBlock) {
    return
  }
  for (let level = 1; level <= 6; level++) {
    linkifyAnchors(level, contentBlock)
  }
}

function getHeaderContent (header) {
  const headerHTML = $(header).clone()
  headerHTML.find('.MathJax_Preview').remove()
  headerHTML.find('.MathJax').remove()
  return headerHTML[0].innerHTML
}

function changeHeaderId ($header, id, newId) {
  $header.attr('id', newId)
  const $headerLink = $header.find(`> a.anchor[href="#${id}"]`)
  $headerLink.attr('href', `#${newId}`)
  $headerLink.attr('title', newId)
}

export function deduplicatedHeaderId (view) {
  // headers contained in the last change
  const headers = view.find(':header.raw').removeClass('raw').toArray()
  if (headers.length === 0) {
    return
  }
  if (window.linkifyHeaderStyle === 'gfm') {
    // consistent with GitHub, GitLab, Pandoc & co.
    // all headers contained in the document, in order of appearance
    const allHeaders = view.find(`:header`).toArray()
    // list of finaly assigned header IDs
    const headerIds = new Set()
    for (let j = 0; j < allHeaders.length; j++) {
      const $header = $(allHeaders[j])
      const id = $header.attr('id')
      const newId = createHeaderId(getHeaderContent($header), headerIds)
      changeHeaderId($header, id, newId)
    }
  } else {
    // the legacy way
    for (let i = 0; i < headers.length; i++) {
      const id = $(headers[i]).attr('id')
      if (!id) continue
      const duplicatedHeaders = view.find(`:header[id="${id}"]`).toArray()
      for (let j = 0; j < duplicatedHeaders.length; j++) {
        if (duplicatedHeaders[j] !== headers[i]) {
          const newId = id + j
          const $header = $(duplicatedHeaders[j])
          changeHeaderId($header, id, newId)
        }
      }
    }
  }
}

export function renderTOC (view) {
  const tocs = view.find('.toc').toArray()
  for (let i = 0; i < tocs.length; i++) {
    const toc = $(tocs[i])
    const id = `toc${i}`
    toc.attr('id', id)
    const target = $(`#${id}`)
    target.html('')
    /* eslint-disable no-unused-vars */
    const TOC = new window.Toc('doc', {
      level: 3,
      top: -1,
      class: 'toc',
      targetId: id,
      process: getHeaderContent
    })
    /* eslint-enable no-unused-vars */
    if (target.text() === 'undefined') { target.html('') }
    target.replaceWith(target.html())
  }
}

export function scrollToHash () {
  const hash = location.hash
  location.hash = ''
  location.hash = hash
}

function highlightRender (code, lang) {
  if (!lang || /no(-?)highlight|plain|text/.test(lang)) { return }
  code = escapeHTML(code)
  if (lang === 'sequence') {
    return `<div class="sequence-diagram raw">${code}</div>`
  } else if (lang === 'flow') {
    return `<div class="flow-chart raw">${code}</div>`
  } else if (lang === 'graphviz') {
    return `<div class="graphviz raw">${code}</div>`
  } else if (lang === 'mermaid') {
    return `<div class="mermaid raw">${code}</div>`
  } else if (lang === 'abc') {
    return `<div class="abc raw">${code}</div>`
  } else if (lang === 'vega') {
    return `<div class="vega raw">${code}</div>`
  } else if (lang === 'geo') {
    return `<div class="geo raw">${code}</div>`
  }
  const result = {
    value: code
  }
  const showlinenumbers = /=$|=\d+$|=\+$/.test(lang)
  if (showlinenumbers) {
    let startnumber = 1
    const matches = lang.match(/=(\d+)$/)
    if (matches) { startnumber = parseInt(matches[1]) }
    const lines = result.value.split('\n')
    const linenumbers = []
    for (let i = 0; i < lines.length - 1; i++) {
      linenumbers[i] = `<span data-linenumber='${startnumber + i}'></span>`
    }
    const continuelinenumber = /=\+$/.test(lang)
    const linegutter = `<div class='gutter linenumber${continuelinenumber ? ' continue' : ''}'>${linenumbers.join('\n')}</div>`
    result.value = `<div class='wrapper'>${linegutter}<div class='code'>${result.value}</div></div>`
  }
  return result.value
}

export const md = markdownit('default', {
  html: true,
  breaks: window.defaultUseHardbreak,
  langPrefix: '',
  linkify: true,
  typographer: true,
  highlight: highlightRender
})
window.md = md

md.use(require('markdown-it-abbr'))
md.use(require('markdown-it-footnote'))
md.use(require('markdown-it-deflist'))
md.use(require('markdown-it-mark'))
md.use(require('markdown-it-ins'))
md.use(require('markdown-it-sub'))
md.use(require('markdown-it-sup'))
md.use(require('markdown-it-mathjax')({
  beforeMath: '<span class="mathjax raw">',
  afterMath: '</span>',
  beforeInlineMath: '<span class="mathjax raw">\\(',
  afterInlineMath: '\\)</span>',
  beforeDisplayMath: '<span class="mathjax raw">\\[',
  afterDisplayMath: '\\]</span>'
}))
md.use(require('markdown-it-imsize'))
md.use(require('markdown-it-ruby'))
md.use(require('markdown-it-multimd-table'), {
  multiline: true,
  rowspan: true,
  headerless: false
})

window.emojify.setConfig({
  blacklist: {
    elements: ['script', 'textarea', 'a', 'pre', 'code', 'svg'],
    classes: ['no-emojify']
  },
  img_dir: emojifyImageDir,
  ignore_emoticons: true
})

function renderContainer (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('role', 'alert')
  tokens[idx].attrJoin('class', 'alert')
  tokens[idx].attrJoin('class', `alert-${tokens[idx].info.trim()}`)
  return self.renderToken(...arguments)
}
md.use(markdownitContainer, 'success', { render: renderContainer })
md.use(markdownitContainer, 'info', { render: renderContainer })
md.use(markdownitContainer, 'warning', { render: renderContainer })
md.use(markdownitContainer, 'danger', { render: renderContainer })
md.use(markdownitContainer, 'spoiler', {
  validate: function (params) {
    return params.trim().match(/^spoiler(\s+.*)?$/)
  },
  render: function (tokens, idx) {
    const m = tokens[idx].info.trim().match(/^spoiler(\s+.*)?$/)

    if (tokens[idx].nesting === 1) {
      // opening tag
      const summary = m[1] && m[1].trim()
      if (summary) {
        return `<details><summary>${md.renderInline(summary)}</summary>\n`
      } else {
        return `<details>\n`
      }
    } else {
      // closing tag
      return '</details>\n'
    }
  }
})

const defaultImageRender = md.renderer.rules.image
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('class', 'raw')
  return defaultImageRender(...arguments)
}
md.renderer.rules.list_item_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('class', 'raw')
  return self.renderToken(...arguments)
}
md.renderer.rules.blockquote_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('class', 'raw')
  return self.renderToken(...arguments)
}
md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('class', 'raw')
  return self.renderToken(...arguments)
}
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
  let langName = ''
  let highlighted

  if (info) {
    langName = info.split(/\s+/g)[0]
    if (/!$/.test(info)) token.attrJoin('class', 'wrap')
    token.attrJoin('class', options.langPrefix + langName.replace(/=$|=\d+$|=\+$|!$|=!$/, ''))
    token.attrJoin('class', 'hljs')
    token.attrJoin('class', 'raw')
  }

  if (options.highlight) {
    highlighted = options.highlight(token.content, langName) || md.utils.escapeHtml(token.content)
  } else {
    highlighted = md.utils.escapeHtml(token.content)
  }

  if (highlighted.indexOf('<pre') === 0) {
    return `${highlighted}\n`
  }

  return `<pre><code${self.renderAttrs(token)}>${highlighted}</code></pre>\n`
}

const makePlantumlURL = (umlCode) => {
  const format = 'svg'
  const code = plantumlEncoder.encode(umlCode)
  return `${plantumlServer}/${format}/${code}`
}

// https://github.com/qjebbs/vscode-plantuml/tree/master/src/markdown-it-plantuml
md.renderer.rules.plantuml = (tokens, idx) => {
  const token = tokens[idx]
  if (token.type !== 'plantuml') {
    return tokens[idx].content
  }

  const url = makePlantumlURL(token.content)
  return `<img src="${url}" />`
}

// https://github.com/qjebbs/vscode-plantuml/tree/master/src/markdown-it-plantuml
md.core.ruler.push('plantuml', (state) => {
  const blockTokens = state.tokens
  for (const blockToken of blockTokens) {
    if (blockToken.type === 'fence' && blockToken.info === 'plantuml') {
      blockToken.type = 'plantuml'
    }
  }
})

// youtube
const youtubePlugin = new Plugin(
  // regexp to match
  /{%youtube\s*([\d\D]*?)\s*%}/,

  (match, utils) => {
    const videoid = match[1]
    if (!videoid) return
    const div = $('<div class="youtube raw"></div>')
    div.attr('data-videoid', videoid)
    const thumbnailSrc = `//img.youtube.com/vi/${videoid}/hqdefault.jpg`
    const image = `<img src="${thumbnailSrc}" />`
    div.append(image)
    const icon = '<i class="icon fa fa-youtube-play fa-5x"></i>'
    div.append(icon)
    return div[0].outerHTML
  }
)
// vimeo
const vimeoPlugin = new Plugin(
  // regexp to match
  /{%vimeo\s*([\d\D]*?)\s*%}/,

  (match, utils) => {
    const videoid = match[1].split(/[?&=]+/)[0]
    if (!videoid) return
    const div = $('<div class="vimeo raw"></div>')
    div.attr('data-videoid', videoid)
    const icon = '<i class="icon fa fa-vimeo-square fa-5x"></i>'
    div.append(icon)
    return div[0].outerHTML
  }
)
// gist
const gistPlugin = new Plugin(
  // regexp to match
  /{%gist\s*([\d\D]*?)\s*%}/,

  (match, utils) => {
    const gistid = match[1].split(/[?&=]+/)[0]
    const code = `<code data-gist-id="${gistid}"></code>`
    return code
  }
)
// TOC
const tocPlugin = new Plugin(
  // regexp to match
  /^\[TOC\]$/i,

  (match, utils) => '<div class="toc"></div>'
)
// slideshare
const slidesharePlugin = new Plugin(
  // regexp to match
  /{%slideshare\s*([\d\D]*?)\s*%}/,

  (match, utils) => {
    const slideshareid = match[1].split(/[?&=]+/)[0]
    const div = $('<div class="slideshare raw"></div>')
    div.attr('data-slideshareid', slideshareid)
    return div[0].outerHTML
  }
)
// speakerdeck
const speakerdeckPlugin = new Plugin(
  // regexp to match
  /{%speakerdeck\s*([\d\D]*?)\s*%}/,

  (match, utils) => {
    const speakerdeckid = match[1]
    const div = $('<div class="speakerdeck raw"></div>')
    div.attr('data-speakerdeckid', speakerdeckid)
    return div[0].outerHTML
  }
)
// pdf
const pdfPlugin = new Plugin(
  // regexp to match
  /{%pdf\s*([\d\D]*?)\s*%}/,

  (match, utils) => {
    const pdfurl = match[1]
    if (!isURL(pdfurl)) return match[0]
    const div = $('<div class="pdf raw"></div>')
    div.attr('data-pdfurl', pdfurl)
    return div[0].outerHTML
  }
)

const emojijsPlugin = new Plugin(
  // regexp to match emoji shortcodes :something:
  // We generate an universal regex that guaranteed only contains the
  // emojies we have available. This should prevent all false-positives
  new RegExp(':(' + window.emojify.emojiNames.map((item) => { return RegExp.escape(item) }).join('|') + '):', 'i'),

  (match, utils) => {
    const emoji = match[1].toLowerCase()
    const div = $(`<img class="emoji" alt=":${emoji}:" src="${emojifyImageDir}/${emoji}.png"></img>`)
    return div[0].outerHTML
  }
)

// yaml meta, from https://github.com/eugeneware/remarkable-meta
function get (state, line) {
  const pos = state.bMarks[line]
  const max = state.eMarks[line]
  return state.src.substr(pos, max - pos)
}

function meta (state, start, end, silent) {
  if (start !== 0 || state.blkIndent !== 0) return false
  if (state.tShift[start] < 0) return false
  if (!get(state, start).match(/^---$/)) return false

  const data = []
  for (var line = start + 1; line < end; line++) {
    const str = get(state, line)
    if (str.match(/^(\.{3}|-{3})$/)) break
    if (state.tShift[line] < 0) break
    data.push(str)
  }

  if (line >= end) return false

  try {
    md.meta = window.jsyaml.safeLoad(data.join('\n')) || {}
    delete md.metaError
  } catch (err) {
    md.metaError = err
    console.warn(err)
    return false
  }

  state.line = line + 1

  return true
}

function metaPlugin (md) {
  md.meta = md.meta || {}
  md.block.ruler.before('code', 'meta', meta, {
    alt: []
  })
}

md.use(metaPlugin)
md.use(emojijsPlugin)
md.use(youtubePlugin)
md.use(vimeoPlugin)
md.use(gistPlugin)
md.use(tocPlugin)
md.use(slidesharePlugin)
md.use(speakerdeckPlugin)
md.use(pdfPlugin)

export default {
  md
}
