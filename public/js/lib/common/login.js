/* eslint-env browser, jquery */
/* global Cookies */

import { serverurl } from '../config'

let checkAuth = false
let profile = null
let lastLoginState = getLoginState()
let lastUserId = getUserId()
var loginStateChangeEvent = null

export function setloginStateChangeEvent (func) {
  loginStateChangeEvent = func
}

export function resetCheckAuth () {
  checkAuth = false
}

export function setLoginState (bool, id) {
  Cookies.set('loginstate', bool, {
    expires: 365,
    sameSite: 'Lax',
    secure: window.location.protocol === 'https:'
  })
  if (id) {
    Cookies.set('userid', id, {
      expires: 365,
      sameSite: 'Lax',
      secure: window.location.protocol === 'https:'
    })
  } else {
    Cookies.remove('userid')
  }
  lastLoginState = bool
  lastUserId = id
  checkLoginStateChanged()
}

export function checkLoginStateChanged () {
  if (getLoginState() !== lastLoginState || getUserId() !== lastUserId) {
    if (loginStateChangeEvent) setTimeout(loginStateChangeEvent, 100)
    return true
  } else {
    return false
  }
}

export function getLoginState () {
  const state = Cookies.get('loginstate')
  return state === 'true' || state === true
}

export function getUserId () {
  return Cookies.get('userid')
}

export function clearLoginState () {
  Cookies.remove('loginstate')
}

export function checkIfAuth (yesCallback, noCallback) {
  const cookieLoginState = getLoginState()
  if (checkLoginStateChanged()) checkAuth = false
  if (!checkAuth || typeof cookieLoginState === 'undefined') {
    $.get(`${serverurl}/me`)
      .done(data => {
        if (data && data.status === 'ok') {
          profile = data
          yesCallback(profile)
          setLoginState(true, data.id)
        } else {
          noCallback()
          setLoginState(false)
        }
      })
      .fail(() => {
        noCallback()
      })
      .always(() => {
        checkAuth = true
      })
  } else if (cookieLoginState) {
    yesCallback(profile)
  } else {
    noCallback()
  }
}

export default {
  checkAuth,
  profile,
  lastLoginState,
  lastUserId,
  loginStateChangeEvent
}
