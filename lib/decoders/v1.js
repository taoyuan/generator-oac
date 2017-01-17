"use strict";

const _ = require('lodash');
const utils = require('./utils');

exports.accept = function (opts) {
	const version = opts && opts.spec && (opts.spec.swagger || opts.spec.swaggerVersion);
	return utils.satisfies(version, '1.x');
};

exports.decode = function (opts) {
	const spec = opts.spec;
	const data = {
		version: spec.apiVersion,
		title: spec.title,
		description: spec.description,
		moduleName: opts.moduleName,
		serviceName: opts.serviceName,
		domain: spec.basePath ? spec.basePath : 'http://localhost',
		baseUrl: spec.basePath ? spec.basePath : 'http://localhost',
		services: [],
		models: []
	};

	const services = {};
	spec.apis.forEach(function (api) {
		api.operations.forEach(function (op) {

			const serviceName = (op.tags && op.tags[0]) || opts.serviceName || 'API';
			let service = services[serviceName];
			if (!service) {
				service = services[serviceName] = {
					name: serviceName,
					serviceName: serviceName,
					methods: []
				};
				data.services.push(service);
			}

			let methodName = op.nickname;
			if (_.startsWith(methodName, serviceName + '.')) {
				methodName = methodName.substr(serviceName.length + 1);
			}
			methodName = utils.processMethodName(methodName);

			const method = {
				path: api.path,
				serviceName: opts.serviceName,
				methodName: methodName,
				method: op.method,
				isGET: op.method === 'GET',
				summary: op.summary,
				hasOptionalParameter: false,
				parameters: op.parameters,
				headers: []
			};

			let produces = op.produces;
			if (!produces && spec.produces) {
				// default accept 'application/json' for returns
				produces = _.includes(spec.produces, 'application/json') ? ['application/json'] : spec.produces;
			}
			if (produces) {
				method.accepts = produces;
				const headers = [];
				headers.value = [];

				headers.name = 'Accept';
				headers.value.push(produces.map(function (value) {
					return '\'' + value + '\'';
				}).join(', '));

				method.headers.push(headers);
			}

			const consumes = op.consumes || spec.consumes;
			if (consumes) {
				method.contentTypes = consumes;
				method.headers.push({name: 'Content-Type', value: '\'' + consumes + '\''});
			}

			op.parameters = op.parameters ? op.parameters : [];
			op.parameters.forEach(function (parameter) {
				parameter.camelCaseName = _.camelCase(parameter.name);
				if (parameter.enum && parameter.enum.length === 1) {
					parameter.isSingleton = true;
					parameter.singleton = parameter.enum[0];
				}
				if (parameter.paramType === 'body') {
					parameter.isBodyParameter = true;
				} else if (parameter.paramType === 'path') {
					parameter.isPathParameter = true;
				} else if (parameter.paramType === 'query') {
					if (parameter['x-name-pattern']) {
						parameter.isPatternType = true;
						parameter.pattern = parameter['x-name-pattern'];
					}
					parameter.isQueryParameter = true;
				} else if (parameter.paramType === 'header') {
					parameter.isHeaderParameter = true;
				} else if (parameter.paramType === 'form') {
					parameter.isFormParameter = true;
				}
				if (!parameter.required) {
					method.hasOptionalParameter = true;
				}
			});
			service.methods.push(method);
		});
	});


	// models
	_.forEach(spec.models, function (definition, name) {

		const model = _.cloneDeep(definition);
		model.name = name;
		model.modelName = name;
		model.properties = [];

		_.forEach(definition.properties, function (prop, name) {
			prop.name = prop.name || name;
			prop.camelCaseName = _.camelCase(prop.name);
			prop.type = _.capitalize(prop.type);

			model.properties.push(prop);
		});

		data.models.push(model);
	});

	return data;
};
