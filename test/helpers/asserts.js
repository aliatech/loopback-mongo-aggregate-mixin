'use strict';

const _ = require('lodash');
const should = require('should');

module.exports = (app) => {

  const City = app.models.City;
  const Company = app.models.Company;
  const Person = app.models.Person;

  const assert = {};

  assert.person = function (person, compare = null) {
    should.exist(person);
    person.should.be.instanceOf(Person);
    person.should.have.property('id');
    person.should.have.property('name').which.is.String();
    person.should.have.property('birthDate').which.is.Date();
    person.should.have.property('companyId');
    if (compare) {
      person.id.toString().should.eql(compare.id.toString());
      person.name.should.eql(compare.name);
      person.birthDate.should.eql(compare.birthDate);
      person.companyId.toString().should.eql(compare.companyId.toString());
    }
  };

  assert.personsOnlyBirthDate = function (persons) {
    persons.forEach((person) => {
      person.should.be.instanceOf(Person);
      person.should.have.property('birthDate').which.is.Date();
      const personJSON = _.pickBy(person.toJSON(), _.identity);
      personJSON.should.not.have.properties('name', 'companyId');
    });
  };

  assert.company = function (company, compare = null) {
    should.exist(company);
    company.should.be.instanceOf(Company);
    company.should.have.property('id');
    company.should.have.property('name').which.is.String();
    company.should.have.property('sector').which.is.String();
    if (compare) {
      company.id.toString().should.eql(compare.id.toString());
      company.name.should.eql(compare.name);
      company.sector.should.eql(compare.sector);
    }
  };

  assert.city = function (city, compare = null) {
    should.exist(city);
    city.should.be.instanceOf(City);
    city.should.have.property('id');
    city.should.have.property('name').which.is.String();
    city.should.have.property('population').which.is.Number();
    if (compare) {
      city.id.toString().should.eql(compare.id.toString());
      city.name.should.eql(city.name);
      city.population.should.eql(compare.population);
    }
  };

  return assert;
};
