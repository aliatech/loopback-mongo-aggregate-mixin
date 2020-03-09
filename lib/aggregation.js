'use strict';

const _ = require('lodash');

module.exports = class Aggregation {

  /**
   * Aggregation constructor.
   */
  constructor () {
    this.pipeline = [];
    this.options = {};
  }

  /**
   * Append pipeline stages.
   * @param {Object|Object[]} stages One or several stages.
   * @returns {module.Aggregation}
   * @throws Error
   */
  append (stages) {
    if (!_.isArray(stages)) {
      stages = [stages];
    }
    stages.forEach((stage) => {
      let op = Object.keys(stage)[0];
      if (!op) {
        throw new Error('Aggregate stage must have a key');
      }
      if (!_.startsWith(op, '$')) {
        const value = stage[op];
        delete stage[op];
        op = `$${op}`;
        stage[op] = value;
      }
      if (op === '$geoNear') {
        this.pipeline.unshift(stage);
      } else {
        this.pipeline.push(stage);
      }
    });
    return this;
  }

  /**
   * Append $project stage to the pipeline.
   * @param {Object} project Stage value. Admits fields array as Loopback does.
   * @returns {module.Aggregation}
   */
  project (project) {
    project = Aggregation.projectFields(project);
    return this.append({
      $project: project,
    });
  }

  /**
   * Parse $project stage to supports fields array.
   * @param {Object|String[]} fields Fields to project.
   *  If it's array, parse it to be object as Project stage requires.
   * @returns {module.Aggregation}
   */
  static projectFields (fields) {
    let project = fields;
    if (_.isArray(project)) {
      project = _(project).keyBy().mapValues(() => true).value();
    }
    return project;
  }

  /**
   * Append $match stage to the pipeline.
   * @param {Object} match Stage value.
   * @returns {module.Aggregation}
   */
  match (match) {
    return this.append({
      $match: match,
    });
  }

  /**
   * Append $geoNear stage to the pipeline.
   * @param {Object} near Stage options.
   * @returns {module.Aggregation}
   */
  near (near) {
    return this.append({
      $geoNear: near,
    });
  }

  /**
   * Append $unwind stage to the pipeline.
   * @param {Object} unwind Stage options.
   * @returns {module.Aggregation}
   */
  unwind (unwind) {
    return this.append({
      $unwind: unwind,
    });
  }

  /**
   * Append $lookup stage to the pipeline.
   * @param {Object} lookup Stage value.
   * @returns {module.Aggregation}
   */
  lookup (lookup) {
    return this.append({
      $lookup: lookup,
    });
  }

  /**
   * Set the parameter allowDiskUse which enables writing to temporary files preventing memory issues.
   * @param {boolean} value Whether to enable the parameter
   * @returns {module.Aggregation}
   */
  allowDiskUse (value) {
    this.setOption('allowDiskUse', value);
    return this;
  }

  /**
   * Set aggregation options.
   * @see https://docs.mongodb.com/manual/reference/command/aggregate/
   * @param {Object} options Aggregation options
   * @returns {module.Aggregation}
   */
  setOptions (options) {
    _.each(options, (value, key) => {
      if (key === 'allowDiskUse') {
        this.allowDiskUse(value);
      } else {
        this.setOption(key, value);
      }
    });
    return this;
  }

  /**
   * Set an aggregation option
   * @param {String} key Option name
   * @param {*} value Option value
   * @returns {module.Aggregation}
   */
  setOption (key, value) {
    this.options[key] = value;
    return this;
  }

  /**
   * Append $sort stage to the pipeline.
   * @param {Object} sort Stage value.
   * @returns {module.Aggregation}
   */
  sort (sort) {
    return this.append({
      $sort: sort,
    });
  }

  /**
   * Append $skip stage to the pipeline.
   * @param {Object} skip Stage value.
   * @returns {module.Aggregation}
   */
  skip (skip) {
    return this.append({
      $skip: skip,
    });
  }

  /**
   * Append $limit stage to the pipeline.
   * @param {Object} limit Stage value.
   * @returns {module.Aggregation}
   */
  limit (limit) {
    this.append({
      $limit: limit,
    });
  }

  /**
   * Coalesce fields to become a value if result in null.
   * @param {Object} fields Field names to check
   * @param {*} coalesce Coalesce value
   * @returns {module.Aggregation}
   */
  coalesce (fields, /* istanbul ignore next */ coalesce = null) {
    const addFields = _.mapValues(fields, (value, key) => {
      return {$ifNull: [`$${key}`, coalesce]};
    });
    return this.append({
      $addFields: addFields,
    });
  }

  /**
   * Execute aggregate over a MongoDB collection.
   * @param {*} collection MongoDB collection.
   * @returns {Cursor} MongoDB Result cursor.
   */
  exec (collection) {
    return collection.aggregate(this.pipeline, this.options);
  }

};
