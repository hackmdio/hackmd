/* eslint-env browser, jquery */
/* global Cookies */

var lang = 'en'
var userLang = navigator.language || navigator.userLanguage
var userLangCode = userLang.split('-')[0]
var locale = $('.ui-locale')
var supportLangs = []
$('.ui-locale option').each(function () {
  supportLangs.push($(this).val())
})
if (Cookies.get('locale')) {
  lang = Cookies.get('locale')
  if (lang === 'zh') {
    lang = 'zh-TW'
  }
} else if (supportLangs.indexOf(userLang) !== -1) {
  lang = supportLangs[supportLangs.indexOf(userLang)]
} else if (supportLangs.indexOf(userLangCode) !== -1) {
  lang = supportLangs[supportLangs.indexOf(userLangCode)]
}

locale.val(lang)
$('select.ui-locale option[value="' + lang + '"]').attr('selected', 'selected')

locale.change(function () {
  Cookies.set('locale', $(this).val(), {
    expires: 365,
    sameSite: 'Lax',
    secure: window.location.protocol === 'https:'
  })
  window.location.reload()
})
