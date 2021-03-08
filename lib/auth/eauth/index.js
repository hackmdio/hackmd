'use strict'

const Router = require('express').Router
const passport = require('passport')
const Eauth = require('express-eauth')

const config = require('../../config')
const models = require('../../models')
const logger = require('../../logger')
const {
  setReturnToFromReferer
} = require('../utils')

const eauth = module.exports = Router()

class EAuthStreategy extends passport.Strategy {
  constructor (options, verify) {
    if (typeof options === 'function') {
      verify = options
      options = undefined
    }

    options = options || {}

    super(options)

    this.name = options.name || 'eauth'
    this._verify = verify
    this._passReqToCallback = options.passReqToCallback || false
  }

  authenticate (req) {
    const verified = (error, user, info) => {
      if (error) {
        return this.error(error)
      }

      if (!user) {
        return this.fail(info)
      }

      this.success(user, info)
    }

    try {
      if (this._passReqToCallback && req) {
        this._verify(req, verified)
      } else {
        this._verify(verified)
      }
    } catch (e) {
      return this.error(e)
    }
  }
}

passport.use(new EAuthStreategy({
  passReqToCallback: true
}, function (req, done) {
  const address = req.eauth.recoveredAddress
  if (!address) {
    return done(new Error('EAuth failed'), null)
  }

  // construct profile
  const profile = {
    provider: 'eauth',
    id: `eauth-${address}`,
    emails: []
  }

  const stringifiedProfile = JSON.stringify(profile)
  models.User.findOrCreate({
    where: {
      profileid: address
    },
    defaults: {
      profile: stringifiedProfile
    }
  }).spread(function (user, created) {
    if (user) {
      var needSave = false
      if (user.profile !== stringifiedProfile) {
        user.profile = stringifiedProfile
        needSave = true
      }
      if (needSave) {
        user.save().then(function () {
          if (config.debug) { logger.debug('user login: ' + user.id) }
          return done(null, user)
        })
      } else {
        if (config.debug) { logger.debug('user login: ' + user.id) }
        return done(null, user)
      }
    }
  }).catch(function (err) {
    logger.error('eth auth failed: ' + err)
    return done(err, null)
  })
}))

const { signature, message, address, banner } = config.eauth
const eauthMiddleware = new Eauth({ signature, message, address, banner })

eauth.get('/auth/eauth/:Address', eauthMiddleware, function (req, res) {
  return req.eauth.message ? res.send(req.eauth.message) : res.status(400).send()
})

eauth.post('/auth/eauth/:Message/:Signature', eauthMiddleware, function (req, res, next) {
  setReturnToFromReferer(req)
  passport.authenticate('eauth', {
    successReturnToOrRedirect: true
  })(req, res, next)
})
