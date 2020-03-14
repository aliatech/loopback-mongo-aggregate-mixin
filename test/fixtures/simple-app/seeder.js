/* eslint-disable require-jsdoc */

'use strict';

const _ = require('lodash');
const async = require('async');

module.exports = class Seeder {

  constructor (app) {
    this.app = app;
    this.context = {};
  }

  seed (next) {
    const City = this.app.models.City;
    const Company = this.app.models.Company;
    const Person = this.app.models.Person;
    const Country = this.app.models.Country;
    // Seed cities
    async.mapSeries(require('./cities.json'), (cityData, nextItem) => {
      City.create(cityData, nextItem);
    }, (err, cities) => {
      if (err) return next(err);
      context.cities = cities;
      context.cities.forEach((city) => context[city.ref] = city);
      // Seed companies
      async.mapSeries(require('./companies.json'), (companyData, nextItem) => {
        companyData.cityId = _.get(context, companyData.cityId);
        Company.create(companyData, nextItem);
      }, (err, companies) => {
        if (err) return next(err);
        context.companies = companies;
        context.companies.forEach((company) => context[company.ref] = company);
        // Seed persons
        async.mapSeries(require('./persons.json'), (personData, nextItem) => {
          personData.companyId = _.get(context, personData.companyId);
          personData.cityId = _.get(context, personData.cityId);
          Person.create(personData, nextItem);
        }, (err, persons) => {
          if (err) return next(err);
          context.persons = persons;
          context.persons.forEach((person) => context[person.ref] = person);
          // Seed countries
          async.mapSeries(require('./countries.json'), (countryData, nextItem) => {
            Country.create(countryData, nextItem);
          }, (err) => {
            if (err) return next(err);
            next(null, context);
          });
        });
      });
    });
  }

};
