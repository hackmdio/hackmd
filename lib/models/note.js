'use strict'
// external modules
var fs = require('fs')
var path = require('path')
var LZString = require('@hackmd/lz-string')
var base64url = require('base64url')
var md = require('markdown-it')()
var metaMarked = require('@hackmd/meta-marked')
var cheerio = require('cheerio')
var shortId = require('shortid')
var Sequelize = require('sequelize')
var async = require('async')
var moment = require('moment')
var DiffMatchPatch = require('@hackmd/diff-match-patch')
var dmp = new DiffMatchPatch()

const { stripTags } = require('../../utils/string')

// core
var config = require('../config')
var logger = require('../logger')

// ot
var ot = require('../ot')

// permission types
var permissionTypes = ['freely', 'editable', 'limited', 'locked', 'protected', 'private']

module.exports = function (sequelize, DataTypes) {
  var Note = sequelize.define('Note', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4
    },
    shortid: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      defaultValue: shortId.generate
    },
    alias: {
      type: DataTypes.STRING,
      unique: true
    },
    permission: {
      type: DataTypes.ENUM,
      values: permissionTypes
    },
    viewcount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    title: {
      type: DataTypes.TEXT,
      get: function () {
        return sequelize.processData(this.getDataValue('title'), '')
      },
      set: function (value) {
        this.setDataValue('title', sequelize.stripNullByte(value))
      }
    },
    content: {
      type: DataTypes.TEXT('long'),
      get: function () {
        return sequelize.processData(this.getDataValue('content'), '')
      },
      set: function (value) {
        this.setDataValue('content', sequelize.stripNullByte(value))
      }
    },
    authorship: {
      type: DataTypes.TEXT('long'),
      get: function () {
        return sequelize.processData(this.getDataValue('authorship'), [], JSON.parse)
      },
      set: function (value) {
        this.setDataValue('authorship', JSON.stringify(value))
      }
    },
    lastchangeAt: {
      type: DataTypes.DATE
    },
    savedAt: {
      type: DataTypes.DATE
    },
    tags: {
      type: DataTypes.TEXT('long')
    }
  }, {
    paranoid: false,
    hooks: {
      beforeCreate: function (note, options) {
        return new Promise(function (resolve, reject) {
          // if no content specified then use default note
          if (!note.content) {
            let filePath = config.defaultNotePath

            if (note.alias) {
              const notePathInDocPath = path.join(config.docsPath, path.basename(note.alias) + '.md')
              if (Note.checkFileExist(notePathInDocPath)) {
                filePath = notePathInDocPath
              }
            }

            if (Note.checkFileExist(filePath)) {
              const noteInFS = readFileSystemNote(filePath)
              note.title = noteInFS.title
              note.content = noteInFS.content
              if (filePath !== config.defaultNotePath) {
                note.createdAt = noteInFS.lastchangeAt
                note.lastchangeAt = noteInFS.lastchangeAt
              }
            }
          }
          // if no permission specified and have owner then give default permission in config, else default permission is freely
          if (!note.permission) {
            if (note.ownerId) {
              note.permission = config.defaultPermission
            } else {
              note.permission = 'freely'
            }
          }
          return resolve(note)
        })
      },
      afterCreate: function (note, options, callback) {
        return new Promise(function (resolve, reject) {
          sequelize.models.Revision.saveNoteRevision(note, function (err, revision) {
            if (err) {
              return reject(err)
            }
            return resolve(note)
          })
        })
      }
    }
  })

  Note.associate = function (models) {
    Note.belongsTo(models.User, {
      foreignKey: 'ownerId',
      as: 'owner',
      constraints: false,
      onDelete: 'CASCADE',
      hooks: true
    })
    Note.belongsTo(models.User, {
      foreignKey: 'lastchangeuserId',
      as: 'lastchangeuser',
      constraints: false
    })
    Note.hasMany(models.Revision, {
      foreignKey: 'noteId',
      constraints: false
    })
    Note.hasMany(models.Author, {
      foreignKey: 'noteId',
      as: 'authors',
      constraints: false
    })
  }
  Note.checkFileExist = function (filePath) {
    try {
      return fs.statSync(filePath).isFile()
    } catch (err) {
      return false
    }
  }
  Note.encodeNoteId = function (id) {
    // remove dashes in UUID and encode in url-safe base64
    const str = id.replace(/-/g, '')
    const hexStr = Buffer.from(str, 'hex')
    return base64url.encode(hexStr)
  }
  Note.decodeNoteId = function (encodedId) {
    // decode from url-safe base64
    const id = base64url.toBuffer(encodedId).toString('hex')
    // add dashes between the UUID string parts
    const idParts = []
    idParts.push(id.substr(0, 8))
    idParts.push(id.substr(8, 4))
    idParts.push(id.substr(12, 4))
    idParts.push(id.substr(16, 4))
    idParts.push(id.substr(20, 12))
    return idParts.join('-')
  }
  Note.checkNoteIdValid = function (id) {
    var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    var result = id.match(uuidRegex)
    if (result && result.length === 1) { return true } else { return false }
  }
  Note.parseNoteIdAsync = function (noteId) {
    return new Promise((resolve, reject) => {
      Note.parseNoteId(noteId, (err, id) => {
        if (err) {
          return reject(err)
        }
        resolve(id)
      })
    })
  }

  async function syncNote (noteInFS, note) {
    const contentLength = noteInFS.content.length

    let note2 = await note.update({
      title: noteInFS.title,
      content: noteInFS.content,
      lastchangeAt: noteInFS.lastchangeAt
    })
    const revision = await sequelize.models.Revision.saveNoteRevisionAsync(note2)
    // update authorship on after making revision of docs
    const patch = dmp.patch_fromText(revision.patch)
    const operations = Note.transformPatchToOperations(patch, contentLength)
    let authorship = note2.authorship
    for (let i = 0; i < operations.length; i++) {
      authorship = Note.updateAuthorshipByOperation(operations[i], null, authorship)
    }
    note2 = await note.update({
      authorship: authorship
    })
    return note2.id
  }

  Note.parseNoteId = function (noteId, callback) {
    async.series({
      parseNoteIdByAlias: function (_callback) {
        // try to parse note id by alias (e.g. doc)
        Note.findOne({
          where: {
            alias: noteId
          }
        }).then(async function (note) {
          const filePath = path.join(config.docsPath, path.basename(noteId) + '.md')
          if (Note.checkFileExist(filePath)) {
            try {
              if (note) {
                // if doc in filesystem have newer modified time than last change time
                // then will update the doc in db
                const noteInFS = readFileSystemNote(filePath)
                if (shouldSyncNote(note, noteInFS)) {
                  const noteId = await syncNote(noteInFS, note)
                  return callback(null, noteId)
                }
              } else {
                // create new note with alias, and will sync md file in beforeCreateHook
                const note = await Note.create({
                  alias: noteId,
                  owner: null,
                  permission: 'locked'
                })
                return callback(null, note.id)
              }
            } catch (err) {
              return _callback(err, null)
            }
          }
          if (!note) {
            return _callback(null, null)
          }
          return callback(null, note.id)
        }).catch(function (err) {
          return _callback(err, null)
        })
      },
      // parse note id by LZString is deprecated, here for compability
      parseNoteIdByLZString: function (_callback) {
        // Calculate minimal string length for an UUID that is encoded
        // base64 encoded and optimize comparsion by using -1
        // this should make a lot of LZ-String parsing errors obsolete
        // as we can assume that a nodeId that is 48 chars or longer is a
        // noteID.
        const base64UuidLength = ((4 * 36) / 3) - 1
        if (!(noteId.length > base64UuidLength)) {
          return _callback(null, null)
        }
        // try to parse note id by LZString Base64
        try {
          var id = LZString.decompressFromBase64(noteId)
          if (id && Note.checkNoteIdValid(id)) { return callback(null, id) } else { return _callback(null, null) }
        } catch (err) {
          if (err.message === 'Cannot read property \'charAt\' of undefined') {
            logger.warning('Looks like we can not decode "' + noteId + '" with LZString. Can be ignored.')
          } else {
            logger.error(err)
          }
          return _callback(null, null)
        }
      },
      parseNoteIdByBase64Url: function (_callback) {
        // try to parse note id by base64url
        try {
          var id = Note.decodeNoteId(noteId)
          if (id && Note.checkNoteIdValid(id)) { return callback(null, id) } else { return _callback(null, null) }
        } catch (err) {
          logger.error(err)
          return _callback(null, null)
        }
      },
      parseNoteIdByShortId: function (_callback) {
        // try to parse note id by shortId
        try {
          if (shortId.isValid(noteId)) {
            Note.findOne({
              where: {
                shortid: noteId
              }
            }).then(function (note) {
              if (!note) return _callback(null, null)
              return callback(null, note.id)
            }).catch(function (err) {
              return _callback(err, null)
            })
          } else {
            return _callback(null, null)
          }
        } catch (err) {
          return _callback(err, null)
        }
      }
    }, function (err, result) {
      if (err) {
        logger.error(err)
        return callback(err, null)
      }
      return callback(null, null)
    })
  }
  Note.parseNoteInfo = function (body) {
    var parsed = Note.extractMeta(body)
    var $ = cheerio.load(md.render(parsed.markdown))
    return {
      title: Note.extractNoteTitle(parsed.meta, $),
      tags: Note.extractNoteTags(parsed.meta, $)
    }
  }
  Note.parseNoteTitle = function (body) {
    var parsed = Note.extractMeta(body)
    var $ = cheerio.load(md.render(parsed.markdown))
    return Note.extractNoteTitle(parsed.meta, $)
  }
  Note.extractNoteTitle = function (meta, $) {
    var title = ''
    if (meta.title && (typeof meta.title === 'string' || typeof meta.title === 'number')) {
      title = meta.title
    } else {
      var h1s = $('h1')
      if (h1s.length > 0 && h1s.first().text().split('\n').length === 1) { title = stripTags(h1s.first().text()) }
    }
    if (!title) title = 'Untitled'
    return title
  }
  Note.generateDescription = function (markdown) {
    return markdown.substr(0, 100).replace(/(?:\r\n|\r|\n)/g, ' ')
  }
  Note.decodeTitle = function (title) {
    return title || 'Untitled'
  }
  Note.generateWebTitle = function (title) {
    title = !title || title === 'Untitled' ? 'CodiMD - Collaborative markdown notes' : title + ' - CodiMD'
    return title
  }
  Note.extractNoteTags = function (meta, $) {
    var tags = []
    var rawtags = []
    var metaTags
    if (meta.tags && (typeof meta.tags === 'string' || typeof meta.tags === 'number')) {
      metaTags = ('' + meta.tags).split(',')
    } else if (meta.tags && (Array.isArray(meta.tags))) {
      metaTags = meta.tags
    }
    if (metaTags) {
      for (let i = 0; i < metaTags.length; i++) {
        var text = metaTags[i].trim()
        if (text) rawtags.push(text)
      }
    } else {
      var h6s = $('h6')
      h6s.each(function (key, value) {
        if (/^tags/gmi.test($(value).text())) {
          var codes = $(value).find('code')
          for (let i = 0; i < codes.length; i++) {
            var text = stripTags($(codes[i]).text().trim())
            if (text) rawtags.push(text)
          }
        }
      })
    }
    for (let i = 0; i < rawtags.length; i++) {
      var found = false
      for (let j = 0; j < tags.length; j++) {
        if (tags[j] === rawtags[i]) {
          found = true
          break
        }
      }
      if (!found) { tags.push(rawtags[i]) }
    }
    return tags
  }
  Note.extractMeta = function (content) {
    var obj = null
    try {
      obj = metaMarked(content)
      if (!obj.markdown) obj.markdown = ''
      if (!obj.meta) obj.meta = {}
    } catch (err) {
      obj = {
        markdown: content,
        meta: {}
      }
    }
    return obj
  }
  Note.parseMeta = function (meta) {
    var _meta = {}
    if (meta) {
      if (meta.title && (typeof meta.title === 'string' || typeof meta.title === 'number')) { _meta.title = meta.title }
      if (meta.description && (typeof meta.description === 'string' || typeof meta.description === 'number')) { _meta.description = meta.description }
      if (meta.robots && (typeof meta.robots === 'string' || typeof meta.robots === 'number')) { _meta.robots = meta.robots }
      if (meta.GA && (typeof meta.GA === 'string' || typeof meta.GA === 'number')) { _meta.GA = meta.GA }
      if (meta.disqus && (typeof meta.disqus === 'string' || typeof meta.disqus === 'number')) { _meta.disqus = meta.disqus }
      if (meta.slideOptions && (typeof meta.slideOptions === 'object')) { _meta.slideOptions = meta.slideOptions }
    }
    return _meta
  }
  Note.updateAuthorshipByOperation = function (operation, userId, authorships) {
    var index = 0
    var timestamp = Date.now()
    for (let i = 0; i < operation.length; i++) {
      var op = operation[i]
      if (ot.TextOperation.isRetain(op)) {
        index += op
      } else if (ot.TextOperation.isInsert(op)) {
        const opStart = index
        const opEnd = index + op.length
        let inserted = false
        // authorship format: [userId, startPos, endPos, createdAt, updatedAt]
        if (authorships.length <= 0) authorships.push([userId, opStart, opEnd, timestamp, timestamp])
        else {
          for (let j = 0; j < authorships.length; j++) {
            const authorship = authorships[j]
            if (!inserted) {
              const nextAuthorship = authorships[j + 1] || -1
              if ((nextAuthorship !== -1 && nextAuthorship[1] >= opEnd) || j >= authorships.length - 1) {
                if (authorship[1] < opStart && authorship[2] > opStart) {
                  // divide
                  const postLength = authorship[2] - opStart
                  authorship[2] = opStart
                  authorship[4] = timestamp
                  authorships.splice(j + 1, 0, [userId, opStart, opEnd, timestamp, timestamp])
                  authorships.splice(j + 2, 0, [authorship[0], opEnd, opEnd + postLength, authorship[3], timestamp])
                  j += 2
                  inserted = true
                } else if (authorship[1] >= opStart) {
                  authorships.splice(j, 0, [userId, opStart, opEnd, timestamp, timestamp])
                  j += 1
                  inserted = true
                } else if (authorship[2] <= opStart) {
                  authorships.splice(j + 1, 0, [userId, opStart, opEnd, timestamp, timestamp])
                  j += 1
                  inserted = true
                }
              }
            }
            if (authorship[1] >= opStart) {
              authorship[1] += op.length
              authorship[2] += op.length
            }
          }
        }
        index += op.length
      } else if (ot.TextOperation.isDelete(op)) {
        const opStart = index
        const opEnd = index - op
        if (operation.length === 1) {
          authorships = []
        } else if (authorships.length > 0) {
          for (let j = 0; j < authorships.length; j++) {
            const authorship = authorships[j]
            if (authorship[1] >= opStart && authorship[1] <= opEnd && authorship[2] >= opStart && authorship[2] <= opEnd) {
              authorships.splice(j, 1)
              j -= 1
            } else if (authorship[1] < opStart && authorship[1] < opEnd && authorship[2] > opStart && authorship[2] > opEnd) {
              authorship[2] += op
              authorship[4] = timestamp
            } else if (authorship[2] >= opStart && authorship[2] <= opEnd) {
              authorship[2] = opStart
              authorship[4] = timestamp
            } else if (authorship[1] >= opStart && authorship[1] <= opEnd) {
              authorship[1] = opEnd
              authorship[4] = timestamp
            }
            if (authorship[1] >= opEnd) {
              authorship[1] += op
              authorship[2] += op
            }
          }
        }
        index += op
      }
    }
    // merge
    for (let j = 0; j < authorships.length; j++) {
      const authorship = authorships[j]
      for (let k = j + 1; k < authorships.length; k++) {
        const nextAuthorship = authorships[k]
        if (nextAuthorship && authorship[0] === nextAuthorship[0] && authorship[2] === nextAuthorship[1]) {
          const minTimestamp = Math.min(authorship[3], nextAuthorship[3])
          const maxTimestamp = Math.max(authorship[3], nextAuthorship[3])
          authorships.splice(j, 1, [authorship[0], authorship[1], nextAuthorship[2], minTimestamp, maxTimestamp])
          authorships.splice(k, 1)
          j -= 1
          break
        }
      }
    }
    // clear
    for (let j = 0; j < authorships.length; j++) {
      const authorship = authorships[j]
      if (!authorship[0]) {
        authorships.splice(j, 1)
        j -= 1
      }
    }
    return authorships
  }
  Note.transformPatchToOperations = function (patch, contentLength) {
    var operations = []
    if (patch.length > 0) {
      // calculate original content length
      for (let j = patch.length - 1; j >= 0; j--) {
        var p = patch[j]
        for (let i = 0; i < p.diffs.length; i++) {
          var diff = p.diffs[i]
          switch (diff[0]) {
            case 1: // insert
              contentLength -= diff[1].length
              break
            case -1: // delete
              contentLength += diff[1].length
              break
          }
        }
      }
      // generate operations
      var bias = 0
      var lengthBias = 0
      for (let j = 0; j < patch.length; j++) {
        var operation = []
        const p = patch[j]
        var currIndex = p.start1
        var currLength = contentLength - bias
        for (let i = 0; i < p.diffs.length; i++) {
          const diff = p.diffs[i]
          switch (diff[0]) {
            case 0: // retain
              if (i === 0) {
                // first
                operation.push(currIndex + diff[1].length)
              } else if (i !== p.diffs.length - 1) {
                // mid
                operation.push(diff[1].length)
              } else {
                // last
                operation.push(currLength + lengthBias - currIndex)
              }
              currIndex += diff[1].length
              break
            case 1: // insert
              operation.push(diff[1])
              lengthBias += diff[1].length
              currIndex += diff[1].length
              break
            case -1: // delete
              operation.push(-diff[1].length)
              bias += diff[1].length
              currIndex += diff[1].length
              break
          }
        }
        operations.push(operation)
      }
    }
    return operations
  }

  function readFileSystemNote (filePath) {
    const fsModifiedTime = moment(fs.statSync(filePath).mtime)
    const content = fs.readFileSync(filePath, 'utf8')

    return {
      lastchangeAt: fsModifiedTime,
      title: Note.parseNoteTitle(content),
      content: content
    }
  }

  function shouldSyncNote (note, noteInFS) {
    const dbModifiedTime = moment(note.lastchangeAt || note.createdAt)
    return noteInFS.lastchangeAt.isAfter(dbModifiedTime) && note.content !== noteInFS.content
  }

  return Note
}
