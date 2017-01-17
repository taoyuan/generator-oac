'use strict';

const path = require('path');
const PromiseA = require('bluebird');
const yeomanTest = require('yeoman-test');

module.exports = function (dir, answers) {
	if (typeof dir === 'object') {
		answers = dir;
		dir = null;
	}
	if (dir) process.chdir(dir);
	const context = yeomanTest.run(path.resolve(__dirname, '../../generators/app'), {tmpdir: !dir});

	return PromiseA.resolve(context
		.withOptions({ // execute with options
			// 'skip-install': false,
			// 'skip-npm-install': false,
			// 'skip-sdk': true
		})
		.withPrompts(answers)  // answer prompts
		.toPromise())
		.then(() => process.cwd());
};
