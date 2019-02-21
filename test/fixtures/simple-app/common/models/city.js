'use strict';

module.exports = function (City) {

  City.observe('loaded', function (ctx, next) {
    ctx.data.loaded = true;
    next();
  });

};
