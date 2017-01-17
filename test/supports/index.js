'use strict';

const PromiseA = require('bluebird');
const _ = require('lodash');
require('chai').use(require('chai-as-promised'));

const s = module.exports = {};

const mocks = s.mocks = require('./mocks');
const run = s.run = require('./run');

const app = s.app = require('../server');
const specUrl = s.specUrl = `http://localhost:${app.settings.port}/explorer/swagger.json`;
const baseUrl = s.baseUrl = `http://localhost:${app.settings.port}/api`;

s.users = {
	tom: {
		id: undefined, email: 'tom@example.com', username: 'tom', password: 'password'
	}
};

s.start = function () {
	return app.start().then(() => {
		return run('./test/client', mocks.prompt('app', {specPath: specUrl})).then(p => {
			s.Client = require(p);
			return s.client = new s.Client(baseUrl);
		});
	});
};

s.setup = function (client) {
	return PromiseA.each(_.values(s.users), u => {
		return client.user.create({data: u}).then(result => {
			u.id = result.id;
		});
	});
};

s.startAndSetup = function () {
	return s.start().then(s.setup);
};
