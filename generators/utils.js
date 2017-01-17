'use strict';

const SwaggerParser = require('swagger-parser');

exports.validateSpec = function (specPath) {
	return SwaggerParser.validate(specPath, {validate: {schema: false}});
};
