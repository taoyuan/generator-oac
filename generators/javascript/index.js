const Generator = require('yeoman-generator');
const _ = require('lodash');
const chalk = require('chalk');
const yosay = require('yosay');
const prompts = require('../prompts');
const utils = require('../utils');
const decoders = require('../../lib/decoders');

module.exports = class extends Generator {

	initializing() {
		this.props = this.options;
	}

	writing() {
		const {props} = this;
		const {view} = props;
		const context = Object.assign({}, _.omit(props, 'view'), view);

		this.fs.copyTpl(
			this.templatePath('lib/_requestor.js.ejs'),
			this.destinationPath('lib/_requestor.js'),
			context);

		this.fs.copyTpl(
			this.templatePath('lib/_utils.js.ejs'),
			this.destinationPath('lib/_utils.js'),
			context);

		_.forEach(context.services, s => {
			const ctx = Object.assign({}, context, s);
			this.fs.copyTpl(
				this.templatePath('lib/service.js.ejs'),
				this.destinationPath('lib/' + ctx.name + '.js'),
				ctx);
		});

		this.fs.copyTpl(
			this.templatePath('index.js.ejs'),
			this.destinationPath('index.js'),
			context);

		this.fs.copyTpl(
			this.templatePath('package.json.ejs'),
			this.destinationPath('package.json'),
			context);

		this.fs.copyTpl(
			this.templatePath('_gitignore'),
			this.destinationPath('.gitignore'),
			context);
	}
};
