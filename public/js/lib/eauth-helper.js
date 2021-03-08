/* global web3, $ */

const { serverurl } = require('./config')

let data
let message
let signature

$('#eth-auth-login').on('click', function () {
  // #region Detect metamask
  if (typeof web3 !== 'undefined') {
    console.log('web3 is detected.')
    if (web3.currentProvider.isMetaMask === true) {
      if (web3.eth.accounts[0] === undefined && !web3.currentProvider.enable) {
        return window.alert('Please login metamask first.')
      }
    }
  } else {
    return window.alert('No web3 detected. Please install metamask')
  }
  // #endregion

  function authStart () {
    return $.get(`${serverurl}/auth/eauth/${web3.eth.accounts[0]}`, res => {
      data = ''
      message = ''
      const method = 'eth_signTypedData' // $('#method')[0].value
      if (method === 'personal_sign') {
        data = '0x' + Array.from(res).map(x => x.charCodeAt(0).toString(16)).join('')
        message = res
      } else if (method === 'eth_signTypedData') {
        data = res
        message = res[1].value
      }

      // Call metamask to sign
      const from = web3.eth.accounts[0]
      const params = [data, from]
      web3.currentProvider.sendAsync({
        method,
        params,
        from
      }, async (err, result) => {
        if (err) {
          return console.error(err)
        }

        if (result.error) {
          return console.error(result.error)
        }

        signature = result.result

        if (message !== null && signature !== null) {
          const form = document.createElement('form')
          document.body.appendChild(form)
          form.method = 'post'
          form.action = `${serverurl}/auth/eauth/${message}/${signature}`
          form.submit()
        }
      })
    }).fail(function () {
      // TODO: flash error
    })
  }

  if (web3.currentProvider.enable) {
    web3.currentProvider.enable()
      .then(function () {
        authStart()
      })
  } else if (web3.eth.accounts[0]) {
    authStart()
  }
})
