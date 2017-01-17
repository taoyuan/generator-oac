'use strict';

const path = require('path');

exports.prompt = (name, opts) => {
	const prompts = {
		app: {
			appName: 'mockclient',
			githubAccount: 'loremipsum',
			authorName: 'lorem ipsum',
			authorEmail: 'loremipsum@awesome.com',
			specPath: path.join(__dirname, '../fixtures/petstore_no_security.json')
		}
	};

	return Object.assign({}, prompts[name], opts);
};
