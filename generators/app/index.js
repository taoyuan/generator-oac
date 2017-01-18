'use strict';

const Generator = require('yeoman-generator');
const _ = require('lodash');
const PromiseA = require('bluebird');
const chalk = require('chalk');
const yosay = require('yosay');
const gitConfig = require('git-config');
const beautify = require('gulp-beautify');
const gulpif = require('gulp-if');
const prompts = require('../prompts');
const utils = require('../utils');
const decoders = require('../../lib/decoders');

const jsexts = ['.js.ejs', '.js', '.json.ejs', '.json'];

module.exports = class extends Generator {

	constructor(args, opts) {
		super(...arguments);
		this.option('specPath');

		this.gitc = gitConfig.sync();
		this.gitc.user = this.gitc.user || {};
	}

	initializing() {
		this.registerTransformStream(
			gulpif(f => _.find(jsexts, ext => f.path.endsWith(ext)), beautify({indent_size: 2, max_preserve_newlines: 2}))
		);
	}

	prompting() {
		return PromiseA.resolve(this.prompt(prompts('app', this))).then(answers => {
			if (answers.update) {
				Object.assign(answers, this.answers);
			}
			this.props = _.omitBy(answers, value => _.isNil(value));
		});
	}

	configuring() {
		const {props, spec} = this;
		let promise = PromiseA.resolve();
		if (!spec && props.specPath) {
			promise = promise.then(() => utils.validateSpec(props.specPath).then(spec => {
				if (!spec) throw new Error('Spec is not valid. ' + props.specPath);
				this.spec = spec;
			}));
		}

		return promise;
	}

	writing() {
		const {spec} = this;
		const view = decoders.decode({spec});
		const options = Object.assign({spec, view}, this.props);

		this.composeWith(require.resolve('../javascript'), options);
	}

	installing () {
		if (this.options['skip-npm-install']) {
			return;
		}
		this.npmInstall();
	}
};
