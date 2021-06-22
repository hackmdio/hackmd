export function getConfig () {
  return {
    DROPBOX_APP_KEY: window.DROPBOX_APP_KEY || '',
    domain: window.domain || '',
    urlpath: window.urlpath || '',
    debug: window.debug || false,
    serverurl: `${window.location.protocol}//${domain || window.location.hostname}${port ? ':' + port : ''}${urlpath ? '/' + urlpath : ''}`,
    port: window.location.port,
    noteid: decodeURIComponent(urlpath ? window.location.pathname.slice(urlpath.length + 1, window.location.pathname.length).split('/')[1] : window.location.pathname.split('/')[1]),
    noteurl: `${serverurl}/${noteid}`,
    version: window.version
  }
}

const config = getConfig()
window.serverurl = config.serverurl

export const DROPBOX_APP_KEY = config.DROPBOX_APP_KEY
export const domain = config.domain
export const urlpath = config.urlpath
export const debug = config.debug
export const port = config.port
export const serverurl = config.serverurl
export const noteid = config.noteid
export const noteurl = config.noteurl
export const version = config.version
