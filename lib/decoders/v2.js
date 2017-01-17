"use strict";

const _ = require('lodash');
const semver = require('semver');
const utils = require('./utils');

exports.accept = function (opts) {
	const version = opts && opts.spec && (opts.spec.swagger || opts.spec.swaggerVersion);
	return utils.satisfies(version, '^2.0');
};

exports.decode = function (opts) {
	opts = opts || {};
	const spec = opts.spec;
	const authorizedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'COPY', 'HEAD', 'OPTIONS', 'LINK', 'UNLIK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND'];
	const version = spec.info.version;
	let host = spec.host || opts.host || 'localhost';

	let scheme;
	let i = host.indexOf('://');
	if (i > 0) {
		scheme = host.substr(0, i);
		host = host.substr(i + 3);
	} else {
		scheme = spec.schemes && spec.schemes.length > 0 && spec.schemes[0];
		scheme = scheme || opts.schema || 'http';
	}

	const domain = scheme + '://' + host;
	const data = {
		version: spec.info.version,
		title: spec.info.title,
		description: spec.info.description,
		isSecure: spec.securityDefinitions !== undefined,
		moduleName: opts.moduleName,
		serviceName: opts.serviceName,
		imports: opts.imports,
		domain: domain,
		baseUrl: (domain && spec.basePath) ? domain + spec.basePath.replace(/\/+$/g, '') : '',
		services: [],
		models: []
	};

	// services
	const services = {};
	_.forEach(spec.paths, function (api, path) {
		let globalParams = [];
		/**
		 * @param {Object} op - meta data for the request
		 * @param {string} m - HTTP method name - eg: 'get', 'post', 'put', 'delete'
		 */
		_.forEach(api, function (op, m) {
			if (m.toLowerCase() === 'parameters') {
				globalParams = op;
			}
		});
		_.forEach(api, function (op, m) {
			if (authorizedMethods.indexOf(m.toUpperCase()) === -1) {
				return;
			}

			const serviceName = (op.tags && op.tags[0]) || opts.serviceName || 'API';

			let service = services[serviceName];
			if (!service) {
				service = services[serviceName] = {
					name: serviceName,
					serviceName: serviceName,
					version: version,
					methods: []
				};
				data.services.push(service);

			}

			let methodName = op.operationId;
			if (_.startsWith(methodName, serviceName + '.')) {
				methodName = methodName.substr(serviceName.length + 1);
			}
			methodName = methodName ? utils.normalizeName(methodName) : utils.pathToMethodName(opts, m, path);
			methodName = utils.processMethodName(methodName);
			const method = {
				path,
				methodName,
				method: m.toUpperCase(),
				isGET: m.toUpperCase() === 'GET',
				isPOST: m.toUpperCase() === 'POST',
				summary: op.description || op.summary,
				externalDocs: op.externalDocs,
				isSecure: spec.security !== undefined || op.security !== undefined,
				hasOptionalParameter: false,
				parameters: [],
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
				// method.headers.push({name: 'Content-Type', value: '\'' + consumes + '\''});
			}

			let params = [];
			if (_.isArray(op.parameters)) {
				params = op.parameters;
			}
			params = params.concat(globalParams);
			_.forEach(params, function (parameter) {
				//Ignore parameters which contain the x-exclude-from-bindings extension
				if (parameter['x-exclude-from-bindings'] === true) {
					return;
				}

				// Ignore headers which are injected by proxies & app servers
				// eg: https://cloud.google.com/appengine/docs/go/requests#Go_Request_headers
				if (parameter['x-proxy-header'] && !data.isNode) {
					return;
				}
				if (_.isString(parameter.$ref)) {
					const segments = parameter.$ref.split('/');
					parameter = spec.parameters[segments.length === 1 ? segments[0] : segments[2]];
				}
				parameter.camelCaseName = _.camelCase(parameter.name);
				if (parameter.enum && parameter.enum.length === 1) {
					parameter.isSingleton = true;
					parameter.singleton = parameter.enum[0];
				}
				if (parameter.in === 'body') {
					parameter.isBodyParameter = true;
				} else if (parameter.in === 'path') {
					parameter.isPathParameter = true;
				} else if (parameter.in === 'query') {
					if (parameter['x-name-pattern']) {
						parameter.isPatternType = true;
						parameter.pattern = parameter['x-name-pattern'];
					}
					parameter.isQueryParameter = true;
				} else if (parameter.in === 'header') {
					parameter.isHeaderParameter = true;
				} else if (parameter.in === 'formData') {
					parameter.isFormParameter = true;
				}
				parameter.cardinality = parameter.required ? '' : '?';
				if (!parameter.required) {
					method.hasOptionalParameter = true;
				}
				method.parameters.push(parameter);
			});

			service.methods.push(method);
		});
	});

	// models
	_.forEach(spec.definitions, function (definition, name) {

		if (/^x-/.test(name)) {
			return;
		}

		const model = _.cloneDeep(definition);

		model.name = name;
		model.modelName = name;
		model.version = version;
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
