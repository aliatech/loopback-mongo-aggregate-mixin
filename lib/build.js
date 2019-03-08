'use strict';

const _ = require('lodash');
const path = require('path');
const async = require('async');
const List = require(path.join(__dirname, '../node_modules/loopback-datasource-juggler/lib/list.js'));

/**
 * Attach the behavior of build model instances from database documents.
 * Loopback algorithm to build instances is not callable from outside,
 * this refactor enables it to be used by third-parties.
 * @param {Model} Model Model constructor.
 * @returns {void}
 */
module.exports = function (Model) {
  /**
   * Build model instances.
   * @param {Object[]} result Documents from database.
   * @param {Object} filter Loopback query filter.
   * @param {Object} options Loopback query options.
   * @param {Function} next Callback. Receives error and model instances.
   * @returns {void}
   */
  Model.buildResult = function (result, filter, options, next) {
    const hookState = {};
    Model.include(result, filter.include, options, (err, resultItems) => {
      /* istanbul ignore if */
      if (err) return next(err, resultItems || []);
      /* istanbul ignore else */
      if (Array.isArray(resultItems)) {
        async.map(resultItems, (resultItem, nextItem) => {
          if (options.notify === false) {
            Model.buildResultItem(resultItem, filter, nextItem);
          } else {
            const context = {
              Model,
              data: resultItem,
              isNewInstance: false,
              hookState,
              options,
            };
            Model.notifyObserversOf('loaded', context, (err) => {
              /* istanbul ignore if */
              if (err) return nextItem(err);
              Model.buildResultItem(context.data, filter, nextItem);
            });
          }
        }, (err, items) => {
          /* istanbul ignore if */
          if (err) return next(err);
          // When applying query.collect, some root items may not have
          // Any related/linked item. We store `undefined` in the results
          // Array in such case, which is not desirable from API consumer's
          // Point of view.
          items = items.filter((value) => value !== undefined);
          next(err, items);
        });
      }
    });
  };

  /**
   * Build one model instance.
   * @param {Object} resultItem Document from database.
   * @param {Object} filter Loopback query filter.
   * @param {Function} next Callback. Receives error and model instance.
   * @returns {void}
   */
  Model.buildResultItem = function (resultItem, filter, next) {
    const ctorOpts = {
      fields: filter.fields,
      applySetters: false,
      persisted: true,
    };
    excludeRelationsFromResultItem(resultItem);
    let obj;
    try {
      obj = new Model(resultItem, ctorOpts);
    } catch (err) {
      return next(err);
    }
    if (filter && filter.include) {
      // This handles the case to return parent items including the related
      // Models. For example, Article.find({include: 'tags'}, ...);
      // Try to normalize the include
      const includes = Model.normalizeInclude(_.get(filter, 'include', []));
      includes.forEach((inc) => {
        let relationName = inc;
        if (_.isPlainObject(inc)) {
          relationName = Object.keys(inc)[0];
        }
        // Promote the included model as a direct property
        let included = obj.__cachedRelations[relationName];
        if (Array.isArray(included)) {
          included = new List(included, null, obj);
        }
        /* istanbul ignore else */
        if (included) obj.__data[relationName] = included;
      });
      delete obj.__data.__cachedRelations;
    }
    next(null, obj);
  };

  /**
   * Exclude properties from result document which correspond with model relations.
   * This is fue to relations must be built through include filter.
   * @param {Object} resultItem Document from database.
   * @returns {void}
   */
  function excludeRelationsFromResultItem (resultItem) {
    _.each(resultItem, (value, key) => {
      const rel = Model.relations[key];
      if (rel) {
        delete resultItem[key];
      }
    });
  }
};
