'use strict';

const loopback = require('loopback');
const boot = require('loopback-boot');
const PromiseA = require('bluebird');

const app = module.exports = loopback();

app.start = function () {
  if (app._starting || app._started) {
    return app.ready();
  }
  app._starting = true;
  // start the web server
  return PromiseA.fromCallback(cb => app.listen(cb)).then(() => {
    app._starting = false;
    app._started = true;
    app.emit('started');
    const baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      const explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

app.ready = function () {
  if (app._started) return PromiseA.resolve();
  return PromiseA.fromCallback(cb => app.once('started', cb));
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
