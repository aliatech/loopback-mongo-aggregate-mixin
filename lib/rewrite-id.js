'use strict';

/**
 * Normalize Mongo id property.
 * @param {Object} doc MongoDB document data.
 * @returns {Object}
 */
function rewriteId (doc) {
  if (doc._id) {
    doc.id = doc._id;
    delete doc._id;
  }
  return doc;
}

module.exports = rewriteId;
