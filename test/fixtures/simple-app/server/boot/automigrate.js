'use strict';

module.exports = function (app, done) {
  const ds = app.dataSources.db;
  const collections = Object.keys(app.models);
  ds.automigrate(collections, (err) => {
    if (err) return done(err);
    ds.disconnect();
    done();
  });
};
