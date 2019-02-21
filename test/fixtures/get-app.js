'use strict';

const path = require('path');

module.exports = (appName) => {
  const appDir = path.join(__dirname, appName);
  return require(path.join(appDir, 'server/server.js'));
};
