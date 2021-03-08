'use strict'

const { toBooleanConfig, toArrayConfig, toIntegerConfig } = require('./utils')

module.exports = {
  sourceURL: process.env.CMD_SOURCE_URL,
  domain: process.env.CMD_DOMAIN,
  urlPath: process.env.CMD_URL_PATH,
  host: process.env.CMD_HOST,
  port: toIntegerConfig(process.env.CMD_PORT),
  path: process.env.CMD_PATH,
  loglevel: process.env.CMD_LOGLEVEL,
  urlAddPort: toBooleanConfig(process.env.CMD_URL_ADDPORT),
  useSSL: toBooleanConfig(process.env.CMD_USESSL),
  hsts: {
    enable: toBooleanConfig(process.env.CMD_HSTS_ENABLE),
    maxAgeSeconds: toIntegerConfig(process.env.CMD_HSTS_MAX_AGE),
    includeSubdomains: toBooleanConfig(process.env.CMD_HSTS_INCLUDE_SUBDOMAINS),
    preload: toBooleanConfig(process.env.CMD_HSTS_PRELOAD)
  },
  csp: {
    enable: toBooleanConfig(process.env.CMD_CSP_ENABLE),
    reportURI: process.env.CMD_CSP_REPORTURI
  },
  protocolUseSSL: toBooleanConfig(process.env.CMD_PROTOCOL_USESSL),
  allowOrigin: toArrayConfig(process.env.CMD_ALLOW_ORIGIN),
  useCDN: toBooleanConfig(process.env.CMD_USECDN),
  allowAnonymous: toBooleanConfig(process.env.CMD_ALLOW_ANONYMOUS),
  allowAnonymousEdits: toBooleanConfig(process.env.CMD_ALLOW_ANONYMOUS_EDITS),
  allowAnonymousViews: toBooleanConfig(process.env.CMD_ALLOW_ANONYMOUS_VIEWS),
  allowFreeURL: toBooleanConfig(process.env.CMD_ALLOW_FREEURL),
  forbiddenNoteIDs: toArrayConfig(process.env.CMD_FORBIDDEN_NOTE_IDS),
  defaultPermission: process.env.CMD_DEFAULT_PERMISSION,
  dbURL: process.env.CMD_DB_URL,
  sessionSecret: process.env.CMD_SESSION_SECRET,
  sessionLife: toIntegerConfig(process.env.CMD_SESSION_LIFE),
  responseMaxLag: toIntegerConfig(process.env.CMD_RESPONSE_MAX_LAG),
  imageUploadType: process.env.CMD_IMAGE_UPLOAD_TYPE,
  imgur: {
    clientID: process.env.CMD_IMGUR_CLIENTID
  },
  s3: {
    accessKeyId: process.env.CMD_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.CMD_S3_SECRET_ACCESS_KEY,
    region: process.env.CMD_S3_REGION,
    endpoint: process.env.CMD_S3_ENDPOINT
  },
  minio: {
    accessKey: process.env.CMD_MINIO_ACCESS_KEY,
    secretKey: process.env.CMD_MINIO_SECRET_KEY,
    endPoint: process.env.CMD_MINIO_ENDPOINT,
    secure: toBooleanConfig(process.env.CMD_MINIO_SECURE),
    port: toIntegerConfig(process.env.CMD_MINIO_PORT)
  },
  s3bucket: process.env.CMD_S3_BUCKET,
  azure: {
    connectionString: process.env.CMD_AZURE_CONNECTION_STRING,
    container: process.env.CMD_AZURE_CONTAINER
  },
  facebook: {
    clientID: process.env.CMD_FACEBOOK_CLIENTID,
    clientSecret: process.env.CMD_FACEBOOK_CLIENTSECRET
  },
  twitter: {
    consumerKey: process.env.CMD_TWITTER_CONSUMERKEY,
    consumerSecret: process.env.CMD_TWITTER_CONSUMERSECRET
  },
  github: {
    enterpriseURL: process.env.CMD_GITHUB_ENTERPRISE_URL,
    clientID: process.env.CMD_GITHUB_CLIENTID,
    clientSecret: process.env.CMD_GITHUB_CLIENTSECRET
  },
  bitbucket: {
    clientID: process.env.CMD_BITBUCKET_CLIENTID,
    clientSecret: process.env.CMD_BITBUCKET_CLIENTSECRET
  },
  gitlab: {
    baseURL: process.env.CMD_GITLAB_BASEURL,
    clientID: process.env.CMD_GITLAB_CLIENTID,
    clientSecret: process.env.CMD_GITLAB_CLIENTSECRET,
    scope: process.env.CMD_GITLAB_SCOPE
  },
  mattermost: {
    baseURL: process.env.CMD_MATTERMOST_BASEURL,
    clientID: process.env.CMD_MATTERMOST_CLIENTID,
    clientSecret: process.env.CMD_MATTERMOST_CLIENTSECRET
  },
  oauth2: {
    providerName: process.env.CMD_OAUTH2_PROVIDERNAME,
    baseURL: process.env.CMD_OAUTH2_BASEURL,
    clientID: process.env.CMD_OAUTH2_CLIENT_ID,
    clientSecret: process.env.CMD_OAUTH2_CLIENT_SECRET,
    authorizationURL: process.env.CMD_OAUTH2_AUTHORIZATION_URL,
    tokenURL: process.env.CMD_OAUTH2_TOKEN_URL,
    userProfileURL: process.env.CMD_OAUTH2_USER_PROFILE_URL,
    scope: process.env.CMD_OAUTH2_SCOPE,
    state: process.env.CMD_OAUTH2_STATE,
    userProfileUsernameAttr: process.env.CMD_OAUTH2_USER_PROFILE_USERNAME_ATTR,
    userProfileDisplayNameAttr: process.env.CMD_OAUTH2_USER_PROFILE_DISPLAY_NAME_ATTR,
    userProfileEmailAttr: process.env.CMD_OAUTH2_USER_PROFILE_EMAIL_ATTR,
    userProfilePhotoAttr: process.env.CMD_OAUTH2_USER_PROFILE_PHOTO_ATTR
  },
  dropbox: {
    clientID: process.env.CMD_DROPBOX_CLIENTID,
    clientSecret: process.env.CMD_DROPBOX_CLIENTSECRET,
    appKey: process.env.CMD_DROPBOX_APPKEY
  },
  google: {
    clientID: process.env.CMD_GOOGLE_CLIENTID,
    clientSecret: process.env.CMD_GOOGLE_CLIENTSECRET,
    hostedDomain: process.env.CMD_GOOGLE_HOSTEDDOMAIN
  },
  ldap: {
    providerName: process.env.CMD_LDAP_PROVIDERNAME,
    url: process.env.CMD_LDAP_URL,
    bindDn: process.env.CMD_LDAP_BINDDN,
    bindCredentials: process.env.CMD_LDAP_BINDCREDENTIALS,
    searchBase: process.env.CMD_LDAP_SEARCHBASE,
    searchFilter: process.env.CMD_LDAP_SEARCHFILTER,
    searchAttributes: toArrayConfig(process.env.CMD_LDAP_SEARCHATTRIBUTES),
    usernameField: process.env.CMD_LDAP_USERNAMEFIELD,
    useridField: process.env.CMD_LDAP_USERIDFIELD,
    tlsca: process.env.CMD_LDAP_TLS_CA
  },
  saml: {
    idpSsoUrl: process.env.CMD_SAML_IDPSSOURL,
    idpCert: process.env.CMD_SAML_IDPCERT,
    issuer: process.env.CMD_SAML_ISSUER,
    identifierFormat: process.env.CMD_SAML_IDENTIFIERFORMAT,
    disableRequestedAuthnContext: toBooleanConfig(process.env.CMD_SAML_DISABLEREQUESTEDAUTHNCONTEXT),
    groupAttribute: process.env.CMD_SAML_GROUPATTRIBUTE,
    externalGroups: toArrayConfig(process.env.CMD_SAML_EXTERNALGROUPS, '|', []),
    requiredGroups: toArrayConfig(process.env.CMD_SAML_REQUIREDGROUPS, '|', []),
    attribute: {
      id: process.env.CMD_SAML_ATTRIBUTE_ID,
      username: process.env.CMD_SAML_ATTRIBUTE_USERNAME,
      email: process.env.CMD_SAML_ATTRIBUTE_EMAIL
    }
  },
  eauth: {
    enable: toBooleanConfig(process.env.CMD_EAUTH_ENABLE),
    signature: process.env.CMD_EAUTH_SIGNATURE,
    message: process.env.CMD_EAUTH_MESSAGE,
    address: process.env.CMD_EAUTH_ADDRESS,
    banner: process.env.CMD_EAUTH_BANNER
  },
  plantuml: {
    server: process.env.CMD_PLANTUML_SERVER
  },
  email: toBooleanConfig(process.env.CMD_EMAIL),
  allowEmailRegister: toBooleanConfig(process.env.CMD_ALLOW_EMAIL_REGISTER),
  allowGravatar: toBooleanConfig(process.env.CMD_ALLOW_GRAVATAR),
  allowPDFExport: toBooleanConfig(process.env.CMD_ALLOW_PDF_EXPORT),
  openID: toBooleanConfig(process.env.CMD_OPENID),
  defaultUseHardbreak: toBooleanConfig(process.env.CMD_DEFAULT_USE_HARD_BREAK),
  linkifyHeaderStyle: process.env.CMD_LINKIFY_HEADER_STYLE,
  autoVersionCheck: toBooleanConfig(process.env.CMD_AUTO_VERSION_CHECK)
}
