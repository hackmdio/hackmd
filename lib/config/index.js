
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { merge } = require('lodash')
const deepFreeze = require('deep-freeze')
const { Environment, Permission } = require('./enum')
const logger = require('../logger')
const { getGitCommit, getGitHubURL } = require('./utils')

const appRootPath = path.resolve(__dirname, '../../')
const env = process.env.NODE_ENV || Environment.development
const debugConfig = {
  debug: (env === Environment.development)
}

// Get version string from package.json
const { version, repository } = require(path.join(appRootPath, 'package.json'))

const commitID = getGitCommit(appRootPath)
const sourceURL = getGitHubURL(repository.url, commitID || version)
const fullversion = commitID ? `${version}-${commitID}` : version

const packageConfig = {
  version: version,
  minimumCompatibleVersion: '0.5.0',
  fullversion: fullversion,
  sourceURL: sourceURL
}

const configFilePath = path.resolve(appRootPath, process.env.CMD_CONFIG_FILE ||
'config.json')
const fileConfig = fs.existsSync(configFilePath) ? require(configFilePath)[env] : undefined

let config = require('./default')
merge(config, require('./defaultSSL'))
merge(config, debugConfig)
merge(config, packageConfig)
merge(config, fileConfig)
merge(config, require('./environment'))
merge(config, require('./dockerSecret'))

if (['debug', 'verbose', 'info', 'warn', 'error'].includes(config.loglevel)) {
  logger.level = config.loglevel
} else {
  logger.error('Selected loglevel %s doesn\'t exist, using default level \'debug\'. Available options: debug, verbose, info, warn, error', config.loglevel)
}

// load LDAP CA
if (config.ldap.tlsca) {
  const certificateAuthorities = config.ldap.tlsca.split(',')
  const caContent = []
  for (const ca of certificateAuthorities) {
    if (fs.existsSync(ca)) {
      caContent.push(fs.readFileSync(ca, 'utf8'))
    }
  }
  const tlsOptions = {
    ca: caContent
  }
  config.ldap.tlsOptions = config.ldap.tlsOptions ? Object.assign(config.ldap.tlsOptions, tlsOptions) : tlsOptions
}

// Permission
config.permission = Permission
let defaultPermission = config.permission.editable
if (!config.allowAnonymous && !config.allowAnonymousViews) {
  delete config.permission.freely
  delete config.permission.editable
  delete config.permission.locked
  defaultPermission = config.permission.limited
} else if (!config.allowAnonymous && !config.allowAnonymousEdits) {
  delete config.permission.freely
}
if (!(config.defaultPermission in config.permission)) {
  config.defaultPermission = defaultPermission
}

// cache result, cannot change config in runtime!!!
config.isStandardHTTPsPort = (function isStandardHTTPsPort () {
  return config.useSSL && config.port === 443
})()
config.isStandardHTTPPort = (function isStandardHTTPPort () {
  return !config.useSSL && config.port === 80
})()

// cache serverURL
config.serverURL = (function getserverurl () {
  var url = ''
  if (config.domain) {
    var protocol = config.protocolUseSSL ? 'https://' : 'http://'
    url = protocol + config.domain
    if (config.urlAddPort) {
      if (!config.isStandardHTTPPort || !config.isStandardHTTPsPort) {
        url += ':' + config.port
      }
    }
  }
  if (config.urlPath) {
    url += '/' + config.urlPath
  }
  return url
})()

if (config.serverURL === '') {
  logger.warn('Neither \'domain\' nor \'CMD_DOMAIN\' is configured. This can cause issues with various components.\nHint: Make sure \'protocolUseSSL\' and \'urlAddPort\' or \'CMD_PROTOCOL_USESSL\' and \'CMD_URL_ADDPORT\' are configured properly.')
}

config.Environment = Environment

// auth method
config.isFacebookEnable = config.facebook.clientID && config.facebook.clientSecret
config.isGoogleEnable = config.google.clientID && config.google.clientSecret
config.isDropboxEnable = config.dropbox.clientID && config.dropbox.clientSecret
config.isTwitterEnable = config.twitter.consumerKey && config.twitter.consumerSecret
config.isEmailEnable = config.email
config.isOpenIDEnable = config.openID
config.isGitHubEnable = config.github.clientID && config.github.clientSecret
config.isBitbucketEnable = config.bitbucket.clientID && config.bitbucket.clientSecret
config.isGitLabEnable = config.gitlab.clientID && config.gitlab.clientSecret
config.isMattermostEnable = config.mattermost.clientID && config.mattermost.clientSecret
config.isLDAPEnable = config.ldap.url
config.isSAMLEnable = config.saml.idpSsoUrl
config.isOAuth2Enable = config.oauth2.clientID && config.oauth2.clientSecret
config.isEAuthEnable = config.eauth.enable
config.isPDFExportEnable = config.allowPDFExport

// Check gitlab api version
if (config.gitlab && config.gitlab.version !== 'v4' && config.gitlab.version !== 'v3') {
  logger.warn('config.js contains wrong version (' + config.gitlab.version + ') for gitlab api; it should be \'v3\' or \'v4\'. Defaulting to v4')
  config.gitlab.version = 'v4'
}
// If gitlab scope is api, enable snippets Export/import
config.isGitlabSnippetsEnable = (!config.gitlab.scope || config.gitlab.scope === 'api') && config.isGitLabEnable

// Only update i18n files in development setups
config.updateI18nFiles = (env === Environment.development)

// merge legacy values
const keys = Object.keys(config)
const uppercase = /[A-Z]/
for (let i = keys.length; i--;) {
  const lowercaseKey = keys[i].toLowerCase()
  // if the config contains uppercase letters
  // and a lowercase version of this setting exists
  // and the config with uppercase is not set
  // we set the new config using the old key.
  if (uppercase.test(keys[i]) &&
  config[lowercaseKey] !== undefined &&
  fileConfig[keys[i]] === undefined) {
    logger.warn('config.js contains deprecated lowercase setting for ' + keys[i] + '. Please change your config.js file to replace ' + lowercaseKey + ' with ' + keys[i])
    config[keys[i]] = config[lowercaseKey]
  }
}

// Notify users about the prefix change and inform them they use legacy prefix for environment variables
if (Object.keys(process.env).toString().indexOf('HMD_') !== -1) {
  logger.warn('Using legacy HMD prefix for environment variables. Please change your variables in future. For details see: https://hackmd.io/c/codimd-documentation/%2F%40codimd%2Fmigrate-2-0#1-Drop-old-environment-variables-support')
}

// Generate session secret if it stays on default values
if (config.sessionSecret === 'secret') {
  logger.warn('Session secret not set. Using random generated one. Please set `sessionSecret` in your config.js file. All users will be logged out.')
  config.sessionSecret = crypto.randomBytes(Math.ceil(config.sessionSecretLen / 2)) // generate crypto graphic random number
    .toString('hex') // convert to hexadecimal format
    .slice(0, config.sessionSecretLen) // return required number of characters
}

// Validate upload upload providers
if (['filesystem', 's3', 'minio', 'imgur', 'azure', 'lutim'].indexOf(config.imageUploadType) === -1) {
  logger.error('"imageuploadtype" is not correctly set. Please use "filesystem", "s3", "minio", "azure", "lutim" or "imgur". Defaulting to "filesystem"')
  config.imageUploadType = 'filesystem'
}

// figure out mime types for image uploads
switch (config.imageUploadType) {
  case 'imgur':
    config.allowedUploadMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/gif'
    ]
    break
  default:
    config.allowedUploadMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/gif',
      'image/svg+xml',
      'image/bmp',
      'image/tiff'
    ]
}

// generate correct path
config.sslCAPath.forEach(function (capath, i, array) {
  array[i] = path.resolve(appRootPath, capath)
})

config.appRootPath = appRootPath
config.sslCertPath = path.resolve(appRootPath, config.sslCertPath)
config.sslKeyPath = path.resolve(appRootPath, config.sslKeyPath)
config.dhParamPath = path.resolve(appRootPath, config.dhParamPath)
config.viewPath = path.resolve(appRootPath, config.viewPath)
config.tmpPath = path.resolve(appRootPath, config.tmpPath)
config.defaultNotePath = path.resolve(appRootPath, config.defaultNotePath)
config.docsPath = path.resolve(appRootPath, config.docsPath)
config.uploadsPath = path.resolve(appRootPath, config.uploadsPath)

// make config readonly
config = deepFreeze(config)

module.exports = config
