/* eslint-env browser, jquery */
/* global serverurl, moment */

import store from 'store'
import LZString from '@hackmd/lz-string'

import escapeHTML from 'lodash/escape'

import {
  checkNoteIdValid,
  encodeNoteId
} from './utils'

import { checkIfAuth } from './lib/common/login'

import { urlpath } from './lib/config'

window.migrateHistoryFromTempCallback = null

export function saveHistory (notehistory) {
  checkIfAuth(
    () => {
      saveHistoryToServer(notehistory)
    },
    () => {
      saveHistoryToStorage(notehistory)
    }
  )
}

function saveHistoryToStorage (notehistory) {
  store.set('notehistory', JSON.stringify(notehistory))
}

function saveHistoryToServer (notehistory) {
  $.post(`${serverurl}/history`, {
    history: JSON.stringify(notehistory)
  })
}

export function saveStorageHistoryToServer (callback) {
  const data = store.get('notehistory')
  if (data) {
    $.post(`${serverurl}/history`, {
      history: data
    })
      .done(data => {
        callback(data)
      })
  }
}

export function clearDuplicatedHistory (notehistory) {
  const newnotehistory = []
  for (let i = 0; i < notehistory.length; i++) {
    let found = false
    for (let j = 0; j < newnotehistory.length; j++) {
      const id = notehistory[i].id.replace(/=+$/, '')
      const newId = newnotehistory[j].id.replace(/=+$/, '')
      if (id === newId || notehistory[i].id === newnotehistory[j].id || !notehistory[i].id || !newnotehistory[j].id) {
        const time = (typeof notehistory[i].time === 'number' ? moment(notehistory[i].time) : moment(notehistory[i].time, 'MMMM Do YYYY, h:mm:ss a'))
        const newTime = (typeof newnotehistory[i].time === 'number' ? moment(newnotehistory[i].time) : moment(newnotehistory[i].time, 'MMMM Do YYYY, h:mm:ss a'))
        if (time >= newTime) {
          newnotehistory[j] = notehistory[i]
        }
        found = true
        break
      }
    }
    if (!found) { newnotehistory.push(notehistory[i]) }
  }
  return newnotehistory
}

function addHistory (id, text, time, tags, pinned, notehistory) {
  // only add when note id exists
  if (id) {
    notehistory.push({
      id,
      text,
      time,
      tags,
      pinned
    })
  }
  return notehistory
}

export function removeHistory (id, notehistory) {
  for (let i = 0; i < notehistory.length; i++) {
    if (notehistory[i].id === id) {
      notehistory.splice(i, 1)
      i -= 1
    }
  }
  return notehistory
}

// used for inner
export function writeHistory (title, tags) {
  checkIfAuth(
    () => {
      // no need to do this anymore, this will count from server-side
      // writeHistoryToServer(title, tags);
    },
    () => {
      writeHistoryToStorage(title, tags)
    }
  )
}

function writeHistoryToStorage (title, tags) {
  const data = store.get('notehistory')
  let notehistory
  if (data && typeof data === 'string') {
    notehistory = JSON.parse(data)
  } else {
    notehistory = []
  }

  const newnotehistory = generateHistory(title, tags, notehistory)
  saveHistoryToStorage(newnotehistory)
}

if (!Array.isArray) {
  Array.isArray = arg => Object.prototype.toString.call(arg) === '[object Array]'
}

function renderHistory (title, tags) {
  // console.debug(tags);
  const id = urlpath ? location.pathname.slice(urlpath.length + 1, location.pathname.length).split('/')[1] : location.pathname.split('/')[1]
  return {
    id,
    text: title,
    time: moment().valueOf(),
    tags
  }
}

function generateHistory (title, tags, notehistory) {
  const info = renderHistory(title, tags)
  // keep any pinned data
  let pinned = false
  for (let i = 0; i < notehistory.length; i++) {
    if (notehistory[i].id === info.id && notehistory[i].pinned) {
      pinned = true
      break
    }
  }
  notehistory = removeHistory(info.id, notehistory)
  notehistory = addHistory(info.id, info.text, info.time, info.tags, pinned, notehistory)
  notehistory = clearDuplicatedHistory(notehistory)
  return notehistory
}

// used for outer
export function getHistory (callback) {
  checkIfAuth(
    () => {
      getServerHistory(callback)
    },
    () => {
      getStorageHistory(callback)
    }
  )
}

function getServerHistory (callback) {
  $.get(`${serverurl}/history`)
    .done(data => {
      if (data.history) {
        callback(data.history)
      }
    })
    .fail((xhr, status, error) => {
      console.error(xhr.responseText)
    })
}

export function getStorageHistory (callback) {
  let data = store.get('notehistory')
  if (data) {
    if (typeof data === 'string') { data = JSON.parse(data) }
    return callback(data)
  }
  // eslint-disable-next-line standard/no-callback-literal
  callback([])
}

export function parseHistory (list, callback) {
  checkIfAuth(
    () => {
      parseServerToHistory(list, callback)
    },
    () => {
      parseStorageToHistory(list, callback)
    }
  )
}

export function parseServerToHistory (list, callback) {
  $.get(`${serverurl}/history`)
    .done(data => {
      if (data.history) {
        parseToHistory(list, data.history, callback)
      }
    })
    .fail((xhr, status, error) => {
      console.error(xhr.responseText)
    })
}

export function parseStorageToHistory (list, callback) {
  let data = store.get('notehistory')
  if (data) {
    if (typeof data === 'string') { data = JSON.parse(data) }
    parseToHistory(list, data, callback)
  }
  parseToHistory(list, [], callback)
}

function parseToHistory (list, notehistory, callback) {
  if (!callback) return
  else if (!list || !notehistory) callback(list, notehistory)
  else if (notehistory && notehistory.length > 0) {
    for (let i = 0; i < notehistory.length; i++) {
      // migrate LZString encoded id to base64url encoded id
      try {
        const id = LZString.decompressFromBase64(notehistory[i].id)
        if (id && checkNoteIdValid(id)) {
          notehistory[i].id = encodeNoteId(id)
        }
      } catch (err) {
        console.error(err)
      }
      // parse time to timestamp and fromNow
      const timestamp = (typeof notehistory[i].time === 'number' ? moment(notehistory[i].time) : moment(notehistory[i].time, 'MMMM Do YYYY, h:mm:ss a'))
      notehistory[i].timestamp = timestamp.valueOf()
      notehistory[i].fromNow = timestamp.fromNow()
      notehistory[i].time = timestamp.format('llll')
      // prevent XSS
      notehistory[i].text = escapeHTML(notehistory[i].text)
      notehistory[i].tags = (notehistory[i].tags && notehistory[i].tags.length > 0) ? escapeHTML(notehistory[i].tags).split(',') : []
      // add to list
      if (notehistory[i].id && list.get('id', notehistory[i].id).length === 0) { list.add(notehistory[i]) }
    }
  }
  callback(list, notehistory)
}

export function postHistoryToServer (noteId, data, callback) {
  $.post(`${serverurl}/history/${noteId}`, data)
    .done(result => callback(null, result))
    .fail((xhr, status, error) => {
      console.error(xhr.responseText)
      return callback(error, null)
    })
}

export function deleteServerHistory (noteId, callback) {
  $.ajax({
    url: `${serverurl}/history${noteId ? '/' + noteId : ''}`,
    type: 'DELETE'
  })
    .done(result => callback(null, result))
    .fail((xhr, status, error) => {
      console.error(xhr.responseText)
      return callback(error, null)
    })
}
