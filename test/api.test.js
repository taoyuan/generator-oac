'use strict';

const assert = require('chai').assert;
const s = require('./supports');

describe('oac:api', () => {
	let token;

	before(() => {
		return s.startAndSetup().then(() => s.client.user.login(s.users.tom).then(result => token = result.id));
	});

	it('should not get user without token', () => {
		return assert.isRejected(s.client.user.findById(s.users.tom.id), /status code 401/);
	});

	it('should get user with header token', () => {
		const tom = s.users.tom;
		s.client.authenticate(token);
		return s.client.user.findById(tom.id).then(user => {
			assert.isObject(user);
			assert.propertyVal(user, 'email', tom.email);
		});
	});

	it('should get user with query token', () => {
		const tom = s.users.tom;
		s.client.authenticate({query: true, token});
		return s.client.user.findById(tom.id).then(user => {
			assert.isObject(user);
			assert.propertyVal(user, 'email', tom.email);
		});
	});

});
