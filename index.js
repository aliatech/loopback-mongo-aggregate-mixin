'use strict';

const aggregate = require('./lib/aggregate');
const rewriteId = require('./lib/rewrite-id');

module.exports = function (app) {
  app.loopback.modelBuilder.mixins.define('Aggregate', aggregate);
};

module.exports.rewriteId = rewriteId;
