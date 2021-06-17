/* eslint-env browser, jquery */
/* global moment, serverurl */

import {
  checkIfAuth,
  clearLoginState,
  getLoginState,
  resetCheckAuth,
  setloginStateChangeEvent
} from './lib/common/login'

import {
  clearDuplicatedHistory,
  deleteServerHistory,
  getHistory,
  getStorageHistory,
  parseHistory,
  parseServerToHistory,
  parseStorageToHistory,
  postHistoryToServer,
  removeHistory,
  saveHistory,
  saveStorageHistoryToServer
} from './history'

import { saveAs } from 'file-saver'
import List from 'list.js'
import unescapeHTML from 'lodash/unescape'

require('./locale')

require('../css/cover.css')
require('../css/site.css')

const options = {
  valueNames: ['id', 'text', 'timestamp', 'fromNow', 'time', 'tags', 'pinned'],
  item: `<li class="col-xs-12 col-sm-6 col-md-6 col-lg-4">
          <span class="id" style="display:none;"></span>
          <a href="#">
            <div class="item">
              <div class="ui-history-pin fa fa-thumb-tack fa-fw"></div>
              <div class="ui-history-close fa fa-close fa-fw" data-toggle="modal" data-target=".delete-history-modal"></div>
              <div class="content">
                <h4 class="text"></h4>
                <p>
                  <i><i class="fa fa-clock-o"></i> visited </i><i class="fromNow"></i>
                  <br>
                  <i class="timestamp" style="display:none;"></i>
                  <i class="time"></i>
                </p>
                <p class="tags"></p>
              </div>
            </div>
          </a>
        </li>`,
  page: 18,
  pagination: [{
    outerWindow: 1
  }]
}
const historyList = new List('history', options)

window.migrateHistoryFromTempCallback = pageInit
setloginStateChangeEvent(pageInit)

pageInit()

function pageInit () {
  checkIfAuth(
    data => {
      $('.ui-signin').hide()
      $('.ui-or').hide()
      $('.ui-welcome').show()
      if (data.photo) $('.ui-avatar').prop('src', data.photo).show()
      else $('.ui-avatar').prop('src', '').hide()
      $('.ui-name').html(data.name)
      $('.ui-signout').show()
      $('.ui-history').click()
      parseServerToHistory(historyList, parseHistoryCallback)
    },
    () => {
      $('.ui-signin').show()
      $('.ui-or').show()
      $('.ui-welcome').hide()
      $('.ui-avatar').prop('src', '').hide()
      $('.ui-name').html('')
      $('.ui-signout').hide()
      parseStorageToHistory(historyList, parseHistoryCallback)
    }
  )
}

$('.masthead-nav > li').click(function () {
  $(this).siblings().removeClass('active')
  $(this).addClass('active')
})

// prevent empty link change hash
$('a[href="#"]').click(function (e) {
  e.preventDefault()
})

$('.ui-home').click(function (e) {
  if (!$('#home').is(':visible')) {
    $('.section:visible').hide()
    $('#home').fadeIn()
  }
})

$('.ui-history').click(() => {
  if (!$('#history').is(':visible')) {
    $('.section:visible').hide()
    $('#history').fadeIn()
  }
})

function checkHistoryList () {
  if ($('#history-list').children().length > 0) {
    $('.pagination').show()
    $('.ui-nohistory').hide()
    $('.ui-import-from-browser').hide()
  } else if ($('#history-list').children().length === 0) {
    $('.pagination').hide()
    $('.ui-nohistory').slideDown()
    getStorageHistory(data => {
      if (data && data.length > 0 && getLoginState() && historyList.items.length === 0) {
        $('.ui-import-from-browser').slideDown()
      }
    })
  }
}

function parseHistoryCallback (list, notehistory) {
  checkHistoryList()
  // sort by pinned then timestamp
  list.sort('', {
    sortFunction (a, b) {
      const notea = a.values()
      const noteb = b.values()
      if (notea.pinned && !noteb.pinned) {
        return -1
      } else if (!notea.pinned && noteb.pinned) {
        return 1
      } else {
        if (notea.timestamp > noteb.timestamp) {
          return -1
        } else if (notea.timestamp < noteb.timestamp) {
          return 1
        } else {
          return 0
        }
      }
    }
  })
  // parse filter tags
  const filtertags = []
  for (let i = 0, l = list.items.length; i < l; i++) {
    const tags = list.items[i]._values.tags
    if (tags && tags.length > 0) {
      for (let j = 0; j < tags.length; j++) {
        // push info filtertags if not found
        let found = false
        if (filtertags.includes(tags[j])) { found = true }
        if (!found) { filtertags.push(tags[j]) }
      }
    }
  }
  buildTagsFilter(filtertags)
}

// update items whenever list updated
historyList.on('updated', e => {
  for (let i = 0, l = e.items.length; i < l; i++) {
    const item = e.items[i]
    if (item.visible()) {
      const itemEl = $(item.elm)
      const values = item._values
      const a = itemEl.find('a')
      const pin = itemEl.find('.ui-history-pin')
      const tagsEl = itemEl.find('.tags')
      // parse link to element a
      a.attr('href', `${serverurl}/${values.id}`)
      // parse pinned
      if (values.pinned) {
        pin.addClass('active')
      } else {
        pin.removeClass('active')
      }
      // parse tags
      const tags = values.tags
      if (tags && tags.length > 0 && tagsEl.children().length <= 0) {
        const labels = []
        for (let j = 0; j < tags.length; j++) {
          // push into the item label
          labels.push(`<span class='label label-default'>${tags[j]}</span>`)
        }
        tagsEl.html(labels.join(' '))
      }
    }
  }
  $('.ui-history-close').off('click')
  $('.ui-history-close').on('click', historyCloseClick)
  $('.ui-history-pin').off('click')
  $('.ui-history-pin').on('click', historyPinClick)
})

function historyCloseClick (e) {
  e.preventDefault()
  const id = $(this).closest('a').siblings('span').html()
  const value = historyList.get('id', id)[0]._values
  $('.ui-delete-history-modal-msg').text('Do you really want to delete below history?')
  $('.ui-delete-history-modal-item').html(`<i class="fa fa-file-text"></i> ${value.text}<br><i class="fa fa-clock-o"></i> ${value.time}`)
  clearHistory = false
  deleteId = id
}

function historyPinClick (e) {
  e.preventDefault()
  const $this = $(this)
  const id = $this.closest('a').siblings('span').html()
  const item = historyList.get('id', id)[0]
  const values = item._values
  let pinned = values.pinned
  if (!values.pinned) {
    pinned = true
    item._values.pinned = true
  } else {
    pinned = false
    item._values.pinned = false
  }
  checkIfAuth(() => {
    postHistoryToServer(id, {
      pinned
    }, (err, result) => {
      if (!err) {
        if (pinned) { $this.addClass('active') } else { $this.removeClass('active') }
      }
    })
  }, () => {
    getHistory(notehistory => {
      for (let i = 0; i < notehistory.length; i++) {
        if (notehistory[i].id === id) {
          notehistory[i].pinned = pinned
          break
        }
      }
      saveHistory(notehistory)
      if (pinned) { $this.addClass('active') } else { $this.removeClass('active') }
    })
  })
}

// auto update item fromNow every minutes
setInterval(updateItemFromNow, 60000)

function updateItemFromNow () {
  const items = $('.item').toArray()
  for (let i = 0; i < items.length; i++) {
    const item = $(items[i])
    const timestamp = parseInt(item.find('.timestamp').text())
    item.find('.fromNow').text(moment(timestamp).fromNow())
  }
}

var clearHistory = false
var deleteId = null

function deleteHistory () {
  checkIfAuth(() => {
    deleteServerHistory(deleteId, (err, result) => {
      if (!err) {
        if (clearHistory) {
          historyList.clear()
          checkHistoryList()
        } else {
          historyList.remove('id', deleteId)
          checkHistoryList()
        }
      }
      $('.delete-history-modal').modal('hide')
      deleteId = null
      clearHistory = false
    })
  }, () => {
    if (clearHistory) {
      saveHistory([])
      historyList.clear()
      checkHistoryList()
      deleteId = null
    } else {
      if (!deleteId) return
      getHistory(notehistory => {
        const newnotehistory = removeHistory(deleteId, notehistory)
        saveHistory(newnotehistory)
        historyList.remove('id', deleteId)
        checkHistoryList()
        deleteId = null
      })
    }
    $('.delete-history-modal').modal('hide')
    clearHistory = false
  })
}

$('.ui-delete-history-modal-confirm').click(() => {
  deleteHistory()
})

$('.ui-import-from-browser').click(() => {
  saveStorageHistoryToServer(() => {
    parseStorageToHistory(historyList, parseHistoryCallback)
  })
})

$('.ui-save-history').click(() => {
  getHistory(data => {
    const history = JSON.stringify(data)
    const blob = new Blob([history], {
      type: 'application/json;charset=utf-8'
    })
    saveAs(blob, `codimd_history_${moment().format('YYYYMMDDHHmmss')}`, true)
  })
})

$('.ui-open-history').bind('change', e => {
  const files = e.target.files || e.dataTransfer.files
  const file = files[0]
  const reader = new FileReader()
  reader.onload = () => {
    const notehistory = JSON.parse(reader.result)
    // console.log(notehistory);
    if (!reader.result) return
    getHistory(data => {
      let mergedata = data.concat(notehistory)
      mergedata = clearDuplicatedHistory(mergedata)
      saveHistory(mergedata)
      parseHistory(historyList, parseHistoryCallback)
    })
    $('.ui-open-history').replaceWith($('.ui-open-history').val('').clone(true))
  }
  reader.readAsText(file)
})

$('.ui-clear-history').click(() => {
  $('.ui-delete-history-modal-msg').text('Do you really want to clear all history?')
  $('.ui-delete-history-modal-item').html('There is no turning back.')
  clearHistory = true
  deleteId = null
})

$('.ui-refresh-history').click(() => {
  const lastTags = $('.ui-use-tags').select2('val')
  $('.ui-use-tags').select2('val', '')
  historyList.filter()
  const lastKeyword = $('.search').val()
  $('.search').val('')
  historyList.search()
  $('#history-list').slideUp('fast')
  $('.pagination').hide()

  resetCheckAuth()
  historyList.clear()
  parseHistory(historyList, (list, notehistory) => {
    parseHistoryCallback(list, notehistory)
    $('.ui-use-tags').select2('val', lastTags)
    $('.ui-use-tags').trigger('change')
    historyList.search(lastKeyword)
    $('.search').val(lastKeyword)
    checkHistoryList()
    $('#history-list').slideDown('fast')
  })
})

$('.ui-delete-user-modal-cancel').click(() => {
  $('.ui-delete-user').parent().removeClass('active')
})

$('.ui-logout').click(() => {
  clearLoginState()
  location.href = `${serverurl}/logout`
})

let filtertags = []
$('.ui-use-tags').select2({
  placeholder: $('.ui-use-tags').attr('placeholder'),
  multiple: true,
  data () {
    return {
      results: filtertags
    }
  }
})
$('.select2-input').css('width', 'inherit')
buildTagsFilter([])

function buildTagsFilter (tags) {
  for (let i = 0; i < tags.length; i++) {
    tags[i] = {
      id: i,
      text: unescapeHTML(tags[i])
    }
  }
  filtertags = tags
}
$('.ui-use-tags').on('change', function () {
  const tags = []
  const data = $(this).select2('data')
  for (let i = 0; i < data.length; i++) { tags.push(data[i].text) }
  if (tags.length > 0) {
    historyList.filter(item => {
      const values = item.values()
      if (!values.tags) return false
      let found = false
      for (let i = 0; i < tags.length; i++) {
        if (values.tags.includes(tags[i])) {
          found = true
          break
        }
      }
      return found
    })
  } else {
    historyList.filter()
  }
  checkHistoryList()
})

$('.search').keyup(() => {
  checkHistoryList()
})

$('.ui-export-user-data').click(function (e) {
  document.exportNoteData.submit()
})
