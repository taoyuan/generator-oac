'use strict';

const _ = require('lodash');
const path = require('path');
const utils = require('./utils');

module.exports = function (name, generator) {
	const validate = value => !!value;

	const specPath = [{
		name: 'specPath',
		message: 'Path (or URL) to swagger document:',
		required: true,
		when: () => !generator.specPath,
		default: generator.specPath || 'swagger.json',
		validate: p => {
			return utils.validateSpec(p).then(spec => {
				if (spec) {
					generator.spec = spec;
				}
				return !!spec;
			})
		}
	}];

	const app = [{
		name: 'appName',
		message: 'What would you like to call this project?',
		default: generator.appName || path.basename(process.cwd()), // Default to current folder name
		validate
	}, {
		type: 'input',
		name: 'githubAccount',
		message: 'What is your github username (or organisation)?',
		default: (generator.gitc.github) ? (generator.gitc.github.user) : null
	}, {
		type: 'input',
		name: 'authorName',
		message: 'Who\'s the author of the library?',
		default: answers => generator.gitc.user.name || answers.githubAccount,
	}, {
		type: 'input',
		name: 'authorEmail',
		message: 'What\'s the author\'s email address?',
		default: generator.gitc.user.email,
	}];

	const prompts = {
		app: () => _.concat(specPath, app)
	};

	return prompts[name]();
};
