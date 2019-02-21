/* eslint-disable require-jsdoc */

'use strict';

const _ = require('lodash');
const should = require('should');
const Seeder = require('./fixtures/simple-app/seeder');
const rewriteId = require('../lib/rewrite-id');


describe('Aggregate features', function () {

  let City, Company, Person, assert, context;

  before((done) => {
    require('./fixtures/get-app')('simple-app')((app) => {
      require('../')(app);
      City = app.models.City;
      Company = app.models.Company;
      Person = app.models.Person;
      assert = require('./helpers/asserts')(app);
      const seeder = new Seeder(app);
      seeder.seed((err, _context) => {
        if (err) return done(err);
        context = _context;
        done();
      });
    });
  });

  it('Should aggregate plain where', (done) => {
    const name = context.person1.name;
    Person.aggregate({where: {name}}, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(1);
      const person = persons[0];
      should.exist(person);
      assert.person(person, context.person1);
      done();
    });
  });

  it('Should aggregate where with inq operator', (done) => {
    const names = [context.person1.name, context.person2.name];
    Person.aggregate({
      where: {name: {inq: names}},
    }, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(2);
      assert.person(persons[0], context.person1);
      assert.person(persons[1], context.person2);
      done();
    });
  });

  it('Should aggregate where with and conditions, gt and lt operators', (done) => {
    Person.aggregate({
      where: {
        and: [{
          birthDate: {gt: new Date('1991 01')},
        }, {
          birthDate: {lt: new Date('1991 02')},
        }],
      },
    }, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(2);
      assert.person(persons[0], context.person17);
      assert.person(persons[1], context.person22);
      done();
    });
  });

  it('Should aggregate fields object with positive', (done) => {
    Person.aggregate({fields: {birthDate: true}}, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(context.persons.length);
      assert.personsOnlyBirthDate(persons);
      done();
    });
  });

  it('Should aggregate fields object with negative', (done) => {
    Person.aggregate({fields: {name: false, companyId: false}}, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(context.persons.length);
      assert.personsOnlyBirthDate(persons);
      done();
    });
  });

  it('Should aggregate fields array', (done) => {
    Person.aggregate({fields: ['birthDate']}, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(context.persons.length);
      assert.personsOnlyBirthDate(persons);
      done();
    });
  });

  it('Should aggregate with order, skip and limit', (done) => {
    Person.aggregate({
      order: 'birthDate DESC',
      skip: 2,
      limit: 1,
    }, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(1);
      const person = persons[0];
      should.exist(person);
      assert.person(person, context.person6);
      done();
    });
  });

  it('Should aggregate with composed order', (done) => {
    Person.aggregate({
      order: ['companyId DESC', 'name'],
    }, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(context.persons.length);
      const person = persons[0];
      should.exist(person);
      assert.person(person, context.person24);
      done();
    });
  });

  it('Should aggregate with simple include', (done) => {
    Person.aggregate({include: 'company'}, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(context.persons.length);
      persons.forEach((person) => {
        assert.person(person);
        assert.company(person.company());
      });
      done();
    });
  });

  it('Should aggregate with array of includes', (done) => {
    Person.aggregate({
      where: {companyId: context.company1.id},
      include: ['company', 'city'],
    }, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(5);
      _.range(1, 6)/* [1..5]*/.forEach((num, i) => {
        const person = persons[i];
        assert.person(person, context[`person${num}`]);
        assert.company(person.company(), context.company1);
        assert.city(person.city(), context[`city${num}`]);
      });
      done();
    });
  });

  it('Should aggregate with scoped and nested includes', (done) => {
    Person.aggregate({
      include: {
        relation: 'company',
        scope: {
          fields: ['sector'],
          include: 'city',
        },
      },
    }, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(context.persons.length);
      persons.forEach((person) => {
        assert.person(person);
        const company = person.company();
        should.exist(company);
        company.should.be.instanceOf(Company);
        company.should.have.property('sector').which.is.String();
        const companyJSON = _.pickBy(company.toJSON(), _.identity);
        companyJSON.should.not.have.properties('name');
        const city = company.city();
        assert.city(city);
        city.should.have.property('loaded').which.is.True();
      });
      done();
    });
  });

  it('Should aggregate with $sample stage', (done) => {
    Person.aggregate({
      where: {cityId: context.city3.id},
      aggregate: {$sample: {size: 1}},
    }, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(1);
      const person = persons[0];
      assert.person(person);
      const personIds = [3, 8, 13, 18, 23].map((num) => context[`person${num}`].id.toString());
      person.id.toString().should.be.oneOf(...personIds);
      done();
    });
  });

  it('Should aggregate with $group stage', (done) => {
    const companyIds = [context.company2.id, context.company3.id];
    Person.aggregate({
      where: {companyId: {inq: companyIds}},
      aggregate: [{
        $group: {
          _id: '$companyId',
          total: {$sum: 1},
        },
      }],
    }, (err, groups) => {
      if (err) return done(err);
      should.exist(groups);
      groups.should.be.Array().and.length(2);
      groups.forEach((group) => {
        group.should.have.property('id');
        group.should.have.property('total').which.eql(5);
      });
      _(groups).map('id').intersectionBy(companyIds, String).value().should.length(2);
      done();
    });
  });

  it('Should aggregate where relation properties with $unwind', (done) => {
    Person.aggregate({
      where: {'company.city.name': context.city4.name},
    }, (err, persons) => {
      if (err) return done(err);
      should.exist(persons);
      persons.should.be.Array().and.length(5);
      _.range(16, 21)/* [16..20]*/.forEach((num, i) => {
        const person = persons[i];
        assert.person(person, context[`person${num}`]);
        should.not.exist(person.company()); // Would need include filter
      });
      done();
    });
  });

  it('Should aggregate where hasMany relation properties with $unwind', (done) => {
    Company.aggregate({
      where: {'employees.birthDate': {$gte: new Date('2001')}},
      include: 'employees',
    }, (err, companies) => {
      if (err) return done(err);
      should.exist(companies);
      companies.should.be.Array().and.length(1);
      const company = companies[0];
      should.exist(company);
      assert.company(company, context.company5);
      const persons = company.employees();
      should.exist(persons);
      persons.should.be.Array().and.length(5);
      done();
    });
  });

  it('Should aggregate with custom pipeline and allow to build instances later', (done) => {
    // Retrieve a page number and pagination info
    const pageStart = 5;
    const pageLength = 5;
    Person.aggregate({
      postAggregate: [{
        group: {
          _id: null,
          total: {
            $sum: 1,
          },
          objects: {
            $push: '$$ROOT',
          },
        },
      }, {
        project: {
          total: 1,
          items: {
            $slice: ['$objects', pageStart, pageLength],
          },
        },
      }],
    }, {build: false}, (err, data, build) => {
      if (err) return done(err);
      data = _.first(data);
      should.exist(data);
      data.should.have.property('total').which.eql(context.persons.length);
      data.should.have.property('items').which.is.Array().and.length(5);
      data.items.forEach((item) => item.should.not.be.instanceOf(Person));
      data.items.map(rewriteId);
      build(data.items, (err, persons) => {
        if (err) return done(err);
        _.range(6, 11)/* [6..10]*/.forEach((num, i) => {
          const person = persons[i];
          assert.person(person, context[`person${num}`]);
        });
        done();
      });
    });
  });

  it('Should aggregate passing just the pipeline', (done) => {
    // Retrieve companies using geoNear stage{
    Company.aggregate([{
      geoNear: {
        near: {
          type: 'Point',
          coordinates: [-3.681477, 40.398396], // Near Madrid
        },
        distanceField: 'distance',
        maxDistance: 3000, // 3Km.
        query: {sector: 'Software'},
        spherical: true,
      },
    }], (err, companies) => {
      if (err) return done(err);
      should.exist(companies);
      companies.should.be.Array().and.length(1);
      const company = companies[0];
      assert.company(company, context.company2);
      company.should.have.property('distance').which.is.Number().within(2000, 3000);
      done();
    });
  });

  it('Should aggregate move $geoNear stage to the pipeline head', (done) => {
    Company.aggregate({
      where: {sector: 'Software'},
      aggregate: [{
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [-0.076132, 51.508530], // Near London
          },
          distanceField: 'distance',
          maxDistance: 1000, // 1Km.
          spherical: true,
        },
      }],
    }, (err, companies) => {
      if (err) return done(err);
      should.exist(companies);
      companies.should.be.Array().and.length(1);
      const company = companies[0];
      assert.company(company, context.company1);
      done();
    });
  });

  it('Should aggregate with near shortcut and hasMany include', (done) => {
    Company.aggregate({
      where: {sector: 'Advocacy'},
      include: 'employees',
      near: {
        near: {
          type: 'Point',
          coordinates: [16.363449, 48.210033], // Near Vienna
        },
        distanceField: 'distance',
        maxDistance: 1000, // 1Km.
        spherical: true,
      },
    }, (err, companies) => {
      if (err) return done(err);
      should.exist(companies);
      companies.should.be.Array().and.length(1);
      const company = companies[0];
      assert.company(company, context.company5);
      const employees = company.employees();
      should.exist(employees);
      employees.should.be.Array().and.length(5);
      _.range(21, 26)/* [21..25]*/.forEach((num, i) => {
        const person = employees[i];
        assert.person(person, context[`person${num}`]);
      });
      done();
    });
  });

  it('Should aggregate using explain as custom option', (done) => {
    Company.aggregate({}, {mongodbArgs: {explain: true}}, (err, explain) => {
      if (err) return done(err);
      should.exist(explain);
      explain.should.be.Array().and.length(1);
      const explainItem = explain[0];
      explainItem.should.be.Object();
      explainItem.should.have.property('ok').which.eql(1);
      explainItem.should.have.property('stages').which.is.Array();
      done();
    });
  });

  it('Should produce error if aggregate failed somehow', (done) => {
    Company.aggregate([{wrongStage: 1}], (err, result) => {
      should.exist(err);
      err.should.be.instanceOf(Error);
      should.not.exist(result);
      done();
    });
  });

  it('Should produce error if aggregating without a stage key', (done) => {
    try {
      Company.aggregate([{}], () => {
        should.exist(undefined);
      });
    } catch (err) {
      should.exist(err);
      err.should.be.instanceOf(Error);
      done();
    }
  });

  it('Should aggregate passing build options', (done) => {
    // Get a city without notify operation hooks
    City.aggregate({where: {name: 'London'}}, {buildOptions: {notify: false}}, (err, cities) => {
      if (err) return done(err);
      should.exist(cities);
      cities.should.be.Array().and.length(1);
      const city = cities[0];
      assert.city(city, context.city1);
      city.should.not.have.property('loaded');
      done();
    });
  });

  it('Should produce error when no filter is specified', (done) => {
    Person.aggregate((err) => {
      should.exist(err);
      err.should.be.instanceOf(Error);
      done();
    });
  });

  it('Should produce error if passing invalid data to buildResultItem', (done) => {
    City.buildResultItem({'a.b': 1}, {}, (err, city) => {
      should.exist(err);
      err.should.be.instanceOf(Error);
      should.not.exist(city);
      done();
    });
  });

});
