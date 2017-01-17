'use strict';

const path = require('path');
const helpers = require('yeoman-test');
const assert = require('yeoman-assert');
const s = require('./supports');

describe('oac:app', function () {
	it('scaffold app in test env (with prompts)', function () {
		return helpers.run(path.join(__dirname, '../generators/app'))
			.withPrompts(s.mocks.prompt('app'))
			.toPromise();
	});

});
