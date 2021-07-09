/*
 *  Global UI elements references
 */
/* global $ */

export const getUIElements = () => ({
  spinner: $('.ui-spinner'),
  content: $('.ui-content'),
  toolbar: {
    shortStatus: $('.ui-short-status'),
    status: $('.ui-status'),
    new: $('.ui-new'),
    publish: $('.ui-publish'),
    extra: {
      revision: $('.ui-extra-revision'),
      slide: $('.ui-extra-slide')
    },
    download: {
      markdown: $('.ui-download-markdown'),
      html: $('.ui-download-html'),
      rawhtml: $('.ui-download-raw-html'),
      pdf: $('.ui-download-pdf-beta'),
      pandoc: $('.ui-download-pandoc')
    },
    export: {
      dropbox: $('.ui-save-dropbox'),
      gist: $('.ui-save-gist'),
      snippet: $('.ui-save-snippet')
    },
    import: {
      dropbox: $('.ui-import-dropbox'),
      gist: $('.ui-import-gist'),
      snippet: $('.ui-import-snippet'),
      clipboard: $('.ui-import-clipboard')
    },
    mode: $('.ui-mode'),
    edit: $('.ui-edit'),
    view: $('.ui-view'),
    both: $('.ui-both'),
    night: $('.ui-night'),
    uploadImage: $('.ui-upload-image')
  },
  infobar: {
    lastchange: $('.ui-lastchange'),
    lastchangeuser: $('.ui-lastchangeuser'),
    nolastchangeuser: $('.ui-no-lastchangeuser'),
    permission: {
      permission: $('.ui-permission'),
      label: $('.ui-permission-label'),
      freely: $('.ui-permission-freely'),
      editable: $('.ui-permission-editable'),
      locked: $('.ui-permission-locked'),
      private: $('.ui-permission-private'),
      limited: $('.ui-permission-limited'),
      protected: $('.ui-permission-protected')
    },
    delete: $('.ui-delete-note')
  },
  toc: {
    toc: $('.ui-toc'),
    affix: $('.ui-affix-toc'),
    label: $('.ui-toc-label'),
    dropdown: $('.ui-toc-dropdown')
  },
  area: {
    edit: $('.ui-edit-area'),
    view: $('.ui-view-area'),
    codemirror: $('.ui-edit-area .CodeMirror'),
    codemirrorScroll: $('.ui-edit-area .CodeMirror .CodeMirror-scroll'),
    codemirrorSizer: $('.ui-edit-area .CodeMirror .CodeMirror-sizer'),
    codemirrorSizerInner: $(
      '.ui-edit-area .CodeMirror .CodeMirror-sizer > div'
    ),
    codemirrorLines: $(
      '.ui-edit-area .CodeMirror .CodeMirror-lines'
    ),
    markdown: $('.ui-view-area .markdown-body'),
    resize: {
      handle: $('.ui-resizable-handle'),
      syncToggle: $('.ui-sync-toggle')
    }
  },
  modal: {
    snippetImportProjects: $('#snippetImportModalProjects'),
    snippetImportSnippets: $('#snippetImportModalSnippets'),
    revision: $('#revisionModal'),
    pandocExport: $('.pandoc-export-modal')
  }
})

export default getUIElements
