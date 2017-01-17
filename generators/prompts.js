'use strict';

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const utils = require('./utils');

const REG_AUTHOR = /([\w ]+) <([\w@.]+)>/;
const REG_GIT_ACCOUNT = /(git|https):\/\/(www.)?github.com\/([\w]+)\//;

module.exports = function (name, generator) {
	const validate = value => !!value;

	const pkgpath = path.resolve(process.cwd(), 'package.json');
	const pkg = fs.existsSync(pkgpath) ? require(pkgpath) : null;
	const props = {};
	if (pkg) {
		props.specPath = pkg.spec;
		props.appName = pkg.name;
		let matches;
		if (typeof pkg.author === 'string') {
			matches = REG_AUTHOR.exec(pkg.author);
			if (matches) {
				props.authorName = matches[1];
				props.authorEmail = matches[2];
			}
		}
		if (pkg.repository && typeof pkg.repository.url === 'string') {
			matches = REG_GIT_ACCOUNT.exec(pkg.repository.url);
			if (matches) {
				props.githubAccount = matches[3];
			}
		}
	}


	const specPath = [{
		name: 'specPath',
		message: 'Path (or URL) to swagger document?',
		required: true,
		when: answers => !generator.specPath,
		default: props.specPath || 'swagger.json',
		validate: answer => {
			return utils.validateSpec(answer).then(spec => {
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
		default: generator.appName || props.appName || path.basename(process.cwd()), // Default to current folder name
		validate
	}, {
		type: 'input',
		name: 'githubAccount',
		message: 'What is your github username (or organisation)?',
		default: props.githubAccount || ((generator.gitc.github) ? (generator.gitc.github.user) : null)
	}, {
		type: 'input',
		name: 'authorName',
		message: 'Who\'s the author of the library?',
		default: answers => props.authorName || generator.gitc.user.name || answers.githubAccount,
	}, {
		type: 'input',
		name: 'authorEmail',
		message: 'What\'s the author\'s email address?',
		default: props.authorEmail || generator.gitc.user.email,
	}];

	const prompts = {
		app: () => _.concat(specPath, app)
	};

	return prompts[name]();
};
