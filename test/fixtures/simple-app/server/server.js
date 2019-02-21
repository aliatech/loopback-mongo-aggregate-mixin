'use strict';

const http = require('http');
const loopback = require('loopback');
const boot = require('loopback-boot');
const app = loopback();

module.exports = function (next) {

  // Once the application bootstrapped
  app.start = () => {
    // Mount API REST
    app.use(app.get('restApiRoot'), loopback.rest());
    // Start the web server
    const server = http.createServer(app);
    server.listen(app.get('port'));
    next(app);
  };

  // Bootstrap the application, configure models, datasources and middleware.
  boot(app, __dirname, (err) => {
    if (err) throw err;
    app.start();
  });

};
