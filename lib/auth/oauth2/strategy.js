'use strict'

const { Strategy, InternalOAuthError } = require('passport-oauth2')
const config = require('../../config')

function parseProfile (data) {
  const id = extractProfileAttribute(data, config.oauth2.userProfileIdAttr)
  const username = extractProfileAttribute(data, config.oauth2.userProfileUsernameAttr)
  const displayName = extractProfileAttribute(data, config.oauth2.userProfileDisplayNameAttr)
  const email = extractProfileAttribute(data, config.oauth2.userProfileEmailAttr)
  const photo = extractProfileAttribute(data, config.oauth2.userProfilePhotoAttr)

  if (!username) {
    throw new Error('cannot fetch username: please set correct CMD_OAUTH2_USER_PROFILE_USERNAME_ATTR')
  }

  return {
    id: id || username,
    username: username,
    displayName: displayName,
    email: email,
    photo: photo
  }
}

function extractProfileAttribute (data, path) {
  if (!data) return undefined
  if (typeof path !== 'string') return undefined
  // can handle stuff like `attrs[0].name`
  path = path.split('.')
  for (const segment of path) {
    const m = segment.match(/([\d\w]+)\[(.*)\]/)
    if (!m) {
      data = data[segment]
    } else {
      if (m.length < 3) return undefined
      if (!data[m[1]]) return undefined
      data = data[m[1]][m[2]]
    }
    if (!data) return undefined
  }
  return data
}

function checkAuthorization (data, done) {
  const roles = extractProfileAttribute(data, config.oauth2.rolesClaim)

  if (config.oauth2.accessRole && roles) {
    if (!roles.includes(config.oauth2.accessRole)) {
      return done('Permission denied', null)
    }
  }
}

class OAuth2CustomStrategy extends Strategy {
  constructor (options, verify) {
    options.customHeaders = options.customHeaders || {}
    super(options, verify)
    this.name = 'oauth2'
    this._userProfileURL = options.userProfileURL
    this._oauth2.useAuthorizationHeaderforGET(true)
  }

  userProfile (accessToken, done) {
    this._oauth2.get(this._userProfileURL, accessToken, function (err, body, res) {
      if (err) {
        return done(new InternalOAuthError('Failed to fetch user profile', err))
      }

      let profile, json
      try {
        json = JSON.parse(body)
        checkAuthorization(json, done)
        profile = parseProfile(json)
      } catch (ex) {
        return done(new InternalOAuthError('Failed to parse user profile' + ex.toString()))
      }

      profile.provider = 'oauth2'

      done(null, profile)
    })
  }
}

exports.OAuth2CustomStrategy = OAuth2CustomStrategy
exports.parseProfile = parseProfile
exports.extractProfileAttribute = extractProfileAttribute
