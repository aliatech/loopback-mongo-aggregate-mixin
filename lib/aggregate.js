'use strict';

const _ = require('lodash');
const pg = require('polygoat');
const Aggregation = require('./aggregation');
const rewriteId = require('./rewrite-id');
const debug = require('debug')('loopback:mixins:aggregate');
const buildBehavior = require('./build');

module.exports = function (Model, options) {
  buildBehavior(Model);

  const settings = _.merge({
    build: true, // Automatically build model instances right after getting results from MongoDB
    buildLater: false, // Disable automatic build and provide a function to build on demand
    buildOptions: { // Options that will be passed to build process
      notify: true, // Notify model operation hooks on build
    },
    mongodbArgs: {}, // MongoDB aggregation arguments
  }, options);

  const aggregateCallback = function (documents, filter, options, next) {
    Model.buildResult(documents, filter, options, next);
  };

  /**
   * Perform MongoDB native aggregate.
   * @param {Object} [filter] Loopback query filter.
   * @param {Object} [options] Loopback query options.
   * @param {Function} [next] Callback.
   * @returns {Promise<*>} Only if callback is not passed.
   */
  Model.aggregate = function (filter, options, next) {
    // Process arguments
    const args = [].slice.call(arguments);
    const params = [];
    while (args.length) {
      const arg = args.shift();
      if (!_.isFunction(arg)) {
        params.push(arg);
      } else {
        next = arg;
      }
    }
    [filter, options] = params;
    // Make logic work either with callback or promise
    return pg((done) => {
      options = _.merge({}, settings, options);
      if (options.buildLater === true) {
        options.build = false;
      }
      this.applyScope(filter);
      const modelName = this.modelName;
      const connector = this.getConnector();
      const aggregation = this.getAggregation();
      if (!_.isEmpty(options.mongodbArgs)) {
        if (options.mongodbArgs.explain === true) {
          options.build = false;
        }
        aggregation.setOptions(options.mongodbArgs);
      }
      try {
        if (_.isPlainObject(filter)) {
          if (filter.near) {
            aggregation.near(filter.near);
          }
          if (filter.where) {
            const relationalFields = this.whichFieldsAreRelational(filter.where);
            const directFields = _.difference(_.keys(filter.where), relationalFields);
            if (directFields.length) {
              const directWhere = _.pick(filter.where, directFields);
              const where = connector.buildWhere(modelName, directWhere);
              aggregation.match(where);
            }
            if (relationalFields.length) {
              const relationalWhere = _.pick(filter.where, relationalFields);
              buildLookup(aggregation, relationalWhere);
              aggregation.coalesce(relationalWhere);
              aggregation.match(relationalWhere);
            }
          }
          if (filter.aggregate) {
            aggregation.append(filter.aggregate);
          }
          if (filter.fields) {
            aggregation.project(filter.fields);
          }
          if (filter.order) {
            aggregation.sort(connector.buildSort(modelName, filter.order));
          }
          if (filter.skip || filter.offset) {
            aggregation.skip(filter.skip);
          }
          if (filter.limit) {
            aggregation.limit(filter.limit);
          }
          if (filter.postAggregate) {
            aggregation.append(filter.postAggregate);
          }
        } else if (_.isArray(filter)) {
          aggregation.append(filter);
        } else {
          return done(new Error('Filter must be plain object or array'));
        }
      } catch (err) {
        return done(err);
      }
      debug('Exec pipeline', JSON.stringify(aggregation.pipeline));
      const cursor = aggregation.exec(connector.collection(modelName));
      cursor.toArray((err, data) => {
        if (err) return done(err);
        const build = _.get(options, 'build', true);
        const docs = data.map(rewriteId);
        if (build === true) {
          aggregateCallback(docs, filter, options.buildOptions, done);
        } else {
          if (options.buildLater !== true) {
            done(null, docs);
          } else {
            done(null, [docs, (objects, buildCallback) => {
              aggregateCallback(objects, filter, options.buildOptions, buildCallback);
            }]);
          }
        }
      });
    }, next);
  };

  /**
   * Instance a new Aggregation for this model.
   * @returns {Aggregation}
   */
  Model.getAggregation = function () {
    return new Aggregation();
  };

  /**
   * State what fields correspond to relations given a where filter.
   * @param {Object} where Where filter.
   * @returns {string[]} Fields which correspond to relation names.
   */
  Model.whichFieldsAreRelational = function (where) {
    return _.keys(where).filter((key) => {
      const headKey = key.split('.')[0];
      return Model.relations[headKey];
    });
  };

  /**
   * Build aggregate stages to be able of filter by relation properties.
   * @param {Aggregation} aggregate Aggregation to be mutated.
   * @param {Object} where Where filter. Will search for properties with dot notation.
   * @param {Relation} [parentRelation] States that is a nested relation of this one.
   */
  function buildLookup (aggregate, where, parentRelation = null) {
    _.each(where, (value, key) => {
      const keys = key.split('.');
      const headKey = keys.shift();
      const relation = (parentRelation ? parentRelation.modelTo : Model).relations[headKey];
      if (!relation) return;
      const lookupOpts = buildLookupOptsFromRelation(relation, parentRelation);
      aggregate.lookup(lookupOpts);
      if (_.includes(['hasOne', 'belongsTo'], relation.type)) {
        let unwindPath = relation.name;
        const parentRelationName = _.get(parentRelation, 'name', '');
        if (parentRelationName.length) {
          unwindPath = `${parentRelationName}.${unwindPath}`;
        }
        aggregate.unwind({
          path: `$${ unwindPath}`,
          preserveNullAndEmptyArrays: true,
        });
      }
      /* istanbul ignore else */
      if (keys.length) {
        buildLookup(aggregate, {[keys.join('.')]: value}, relation);
      }
    });
  }

  /**
   * Build $lookup $stage to bring a relation.
   * @param {Relation} relation Relation to bring.
   * @param {Relation} parentRelation States that is a nested relation of this one.
   * @returns {{from: String, localField: String, foreignField: String, as: String}}
   */
  function buildLookupOptsFromRelation (relation, parentRelation) {
    let relationName = relation.name;
    let keyFrom = relation.keyFrom === 'id' ? '_id' : relation.keyFrom;
    const parentRelationName = _.get(parentRelation, 'name', '');
    if (parentRelationName.length) {
      relationName = `${parentRelationName}.${relationName}`;
      keyFrom = `${parentRelationName}.${keyFrom}`;
    }
    return {
      from: relation.modelTo.modelName,
      localField: keyFrom,
      foreignField: relation.keyTo === 'id' ? '_id' : relation.keyTo,
      as: relationName,
    };
  }
};
