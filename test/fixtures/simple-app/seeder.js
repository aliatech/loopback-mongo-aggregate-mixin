/* eslint-disable require-jsdoc */

'use strict';

const _ = require('lodash');
const TestDataBuilder = require('loopback-testing').TestDataBuilder;
const ref = TestDataBuilder.ref;

module.exports = class Seeder {

  constructor (app) {
    this.app = app;
    this.context = {};
  }

  seed (app, next) {
    const City = this.app.models.City;
    const Company = this.app.models.Company;
    const Person = this.app.models.Person;
    const builder = new TestDataBuilder();
    const citiesData = require('./cities.json');
    citiesData.forEach((cityData) => {
      builder.define(cityData.ref, City, cityData);
    });
    const companiesData = require('./companies.json');
    companiesData.forEach((companyData) => {
      companyData.cityId = ref(companyData.cityId);
      builder.define(companyData.ref, Company, companyData);
    });
    const personsData = require('./persons.json');
    personsData.forEach((personData) => {
      personData.companyId = ref(personData.companyId);
      personData.cityId = ref(personData.cityId);
      builder.define(personData.ref, Person, personData);
    });
    builder.buildTo(this.context, (err) => {
      if (err) return next(err);
      this.context.companies = _.range(1, companiesData.length + 1).map((i) => {
        return this.context[`company${i}`];
      });
      this.context.persons = _.range(1, personsData.length + 1).map((i) => {
        return this.context[`person${i}`];
      });
      next(null, this.context);
    });
  }

};
