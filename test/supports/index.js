'use strict';

exports.mocks = require('./mocks');
exports.run = require('./run');

const app = exports.app = require('../server');
exports.specUrl = `http://localhost:${app.settings.port}/explorer/swagger.json`;
exports.baseUrl = `http://localhost:${app.settings.port}/api`;
