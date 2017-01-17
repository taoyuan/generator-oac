'use strict';

const path = require('path');
const helpers = require('yeoman-test');
const assert = require('yeoman-assert');
const s = require('./supports');

describe('oac:app', () => {
	it('should scaffold app for swagger 2.x', () => {
		return helpers.run(path.join(__dirname, '../generators/app'))
			.withPrompts(s.mocks.prompt('app'))
			.toPromise();
	});

});
