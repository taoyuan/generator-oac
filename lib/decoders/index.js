'use strict';

const _ = require('lodash');
const v1 = require('./v1');
const v2 = require('./v2');

const decoders = [v1, v2];

exports.decode = function (opts) {
	const decoder = _.find(decoders, d => d.accept(opts));
	if (!decoder) {
		throw new Error('Can not find suitable decoder for swagger version ' + opts.swagger.swagger);
	}
	const data = decoder.decode(opts);

	//
	_.forEach(data.services, s => {
		_.forEach(s.methods, m => {
			m.pathParams = _.filter(m.parameters, p => p.isPathParameter);
			m.queryParams = _.filter(m.parameters, p => p.isQueryParameter);
			m.headerParams = _.filter(m.parameters, p => p.isHeaderParameter);
			m.formParams = _.filter(m.parameters, p => p.isFormParameter);
			m.requiredParams = _.filter(m.parameters, p => p.required);
			m.optionalParams = _.filter(m.parameters, p => !p.required);
			m.bodyParam = _.find(m.parameters, p => p.isBodyParameter);
		});
		s.camelCaseName = _.camelCase(s.name);
	});

	return data;
};
