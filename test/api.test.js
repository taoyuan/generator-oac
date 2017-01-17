'use strict';

const path = require('path');
const assert = require('yeoman-assert');
const s = require('./supports');

describe('oac:api', function () {

	let Client;
	let client;

	before(() => {
		return s.app.start().then(() => {
			return s.run('./test/client', s.mocks.prompt('app', {specPath: s.specUrl})).then(p => {
				Client = require(p);
				client = new Client(s.baseUrl);
			});
		})
	});

	it.only('should register user', function () {
		return client.user.create({data: {email: 'tom@example.com', password: 'password'}}).then(data => console.log(data));
	});

});
