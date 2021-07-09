'use strict'

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('Notes', 'tags', {
      type: Sequelize.TEXT
    }).catch(function (error) {
      if (error.message === 'SQLITE_ERROR: duplicate column name: tags' || error.message === "ER_DUP_FIELDNAME: Duplicate column name 'tags'" || error.message === 'column "tags" of relation "Notes" already exists') {
        console.log('Migration has already run... ignoring.')
      } else {
        throw error
      }
    })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Notes', 'tags')
  }
}
