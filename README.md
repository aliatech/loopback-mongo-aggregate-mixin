# Loopback Aggregate mixin for MongoDB

[![Build Status](https://travis-ci.org/aliatech/loopback-mongo-aggregate-mixin.svg?branch=master)](https://travis-ci.org/aliatech/loopback-mongo-aggregate-mixin)
[![Coverage Status](https://coveralls.io/repos/github/aliatech/loopback-mongo-aggregate-mixin/badge.svg?branch=master)](https://coveralls.io/github/aliatech/loopback-mongo-aggregate-mixin?branch=master)
[![npm version](https://img.shields.io/npm/v/@aliatech/loopback-mongo-aggregate-mixin.svg?color=blue)](https://www.npmjs.com/package/@aliatech/loopback-mongo-aggregate-mixin)
<!--![npm total downloads](https://img.shields.io/npm/dt/@aliatech/loopback-mongo-aggregate-mixin.svg?color=9cf)-->

Give models the ability to query native **MongoDB aggregates** and **build instances** from results.

* Accepts both Loopback filter's features and pipeline stages, it will merge in a single parsed pipeline to aggregate.  
* Accepts relations' fields within the root where, it will be handled as $lookup stages.
* Refactor the logic from Loopback which is responsible for building the model instances and take advantage of it.

This Loopback mixin is intended to be used together with MongoDB connector.
Works for Loopback 2 and 3.

## How to install

Install the package through NPM

```bash
npm i -S @aliatech/loopback-mongo-aggregate-mixin
```

Install the package through Yarn

```bash
yarn add --prod @aliatech/loopback-mongo-distinct-mixin
```

## Basic configuration

Include the mixin in `server/model-config.json`. Example for Loopback 3:

```json
{
  "_meta": {
    "sources": [
      "loopback/common/models",
      "loopback/server/models",
      "../common/models",
      "./models"
    ],
    "mixins": [
      "loopback/common/mixins",
      "../node_modules/loopback-mongo-aggregate-mixin/lib",
      "../common/mixins"
    ]
  }
}
```

Enable the mixin in your model definition, ie `person.json`.

```json
{
  "name": "Person",
  "properties": {
    "name": "string"
  },
  "mixins": {
    "Aggregate": true
  }
}
```

## Usage

Invoke `aggregate` method passing either:

* A regular Loopback filter (where, fields, include, order, skip, limit)
* An aggregate pipeline
* A combination of both

### Basic example

Find a random sample of 3 persons born after 1980:

```js
app.models.Person.aggregate({
  where: {birthDate: {gt: new Date('1980')}},
  aggregate: [{$sample: {size: 3}}],
}, (err, persons) => {
  if (err) return next(err);
  // persons are Person model instances
});
```

### Find where relation properties

Relation properties can be specified in the "where" criteria using dot notation.
$lookup stages will be automatically generated to reach those relations and filter the root documents by such criteria.
it works like a "LEFT JOIN" feature, however it's still necessary to add the "include" filter
if you require the relation to be hydrated.

Example: Bring persons who are part of a team in which there is some person who is born after 2001

```js
app.models.Person.aggregate({
  where: {'team.persons.birthDate': {$gt: new Date('2001')}},
}, (err, persons) => {
  if (err) return next(err);
  // persons are Person model instances
});
```

Note: It works for hasOne, belongsTo and hasMany. Filtering by embedded properties is not affected and continues to work as usual. 

### Build instances on demand

The aggregate result often needs some processing before building the model instances.
It's possible to postpone the build phase until the models' data are resolved. 

Example: Bring the persons count together with a specific page

```js
Person.aggregate([{
  group: {
    _id: null,
    total: {$sum: 1},
    objects: {$push: '$$ROOT'},
  },
}, {
  project: {
    total: 1,
    items: {$slice: ['$objects', pageStart, pageLength]},
  },
}], {build: false}, (err, data, build) => {
  if (err) return next(err);
  // data is a plan structure {total, items} where items is a array of plain objects, not model instances. 
  build(data.items, (err, persons) => {
    if (err) return next(err);
    // now you got persons as Peron model instances
  });
});
``` 

Note: Pipeline array can be directly passed as argument. Also stage names can obviate "$" character.

Few more things worth commenting here:

* In this case, model documents are not brought as root result,
so we need to disable the automatic build through an options object `{build: false}`.
* When automatic build is disabled, we'll be provided with a build function as a third argument of the callback.
Person instances are finally obtained calling build function with `data.items`.
* Build on demand feature will be always available as a model static method `Model.buildResult`.

### GeoNear example

Combine regular "where" with $geoNear stage.
$geoNear will be moved to the pipeline head as MongoDB requires.

```js
app.models.Company.aggregate({
  where: {sector: 'Software'},
  aggregate: [{
    $geoNear: {
      near: {type: 'Point', coordinates: [-0.076132, 51.508530]},
      distanceField: 'distance',
      maxDistance: 5000, // 5Km.
      spherical: true,
    },
  }],
}, (err, companies) => {
  if (err) return done(err);
  // companies are Company model instances
});
```

## Advanced configuration

Enable the mixin passing an options object instead of just true.

**Available options:**

| Option                | Type      | Required  | Description                                                                                                                                                                                                                                                                                           |
| --------------------- | ----------| --------- | ----------------- |
| mongodbArgs           | object    | optional  | Set defaults for MongoDB aggregate command options (default `{}`). Check the [official documentation](https://docs.mongodb.com/manual/reference/command/aggregate/ "Link to documentation") |
| build                 | boolean   | optional  | Whether to automatically build model instances from aggregate results by default. (default `true`) |
| buildOptions          | object    | optional  | Set defaults for building process options (default `{notify: true}`) |
| buildOptions.notify   | boolean   | optional  | Whether to notify model operation hooks on build by default (default `true`) |

Any of these options can be replaced on the fly with the following syntax:

```js
app.models.Person(filter, options, callback);
```

The `options` argument will be timely merged with the defaults for a single call. 

### Example: Allow MongoDB to use disk

This is a MongoDB aggregate command option that prevent memory issues on large queries.
It can be enabled by default as follows:

```json
{
  "name": "Person",
  "properties": {
    "name": "string"
  },
  "mixins": {
    "Aggregate": {
      "mongodbArgs": {
        "allowDiskUse": true
      }
    }
  }
}
```

Or just enable the option on the fly for a single call:

```js
app.models.Person(filter, {mongodbArgs: {allowDiskUse: true}}, callback);
```

# Debug

Prepend DEBUG environment when running server or tests to display what pipelines are being sent to MongoDB:

```bash
DEBUG=loopback:mixins:aggregate node . # Run server with debug
```

# Testing

Install develop dependences

````bash
npm i -D # If you use NPM
yarn install # If you use Yarn
````

Execute tests

````bash
npm test # Without coverage check
npm run test-with-coverage # With coverage check
````

# Credits

Inspired by [https://github.com/BoLaMN/loopback-mongo-aggregate-mixin](https://github.com/BoLaMN/loopback-mongo-aggregate-mixin "Github's repository")

Developed by
[Juan Costa](https://github.com/Akeri "Github's profile")
for
[ALIA Technologies](https://github.com/aliatech "Github's profile")

[<img src="http://alialabs.com/images/logos/logo-full-big.png" alt="ALIA Technologies" height=100/>](http://alialabs.com "Go to ALIA Technologies' website")
