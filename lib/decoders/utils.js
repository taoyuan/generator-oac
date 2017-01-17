"use strict";

const _ = require('lodash');
const semver = require('semver');

exports.normalizeName = function normalizeName(id) {
	return id.replace(/\./g, '$').replace(/\.|-|{|}/g, '_');
};

exports.pathToMethodName = function pathToMethodName(opts, m, path) {
	if (path === '/' || path === '') {
		return m;
	}

	// clean url path for requests ending with '/'
	const cleanPath = path.replace(/\/$/, '');

	let segments = cleanPath.split('/').slice(1);
	segments = _.transform(segments, function (result, segment) {
		if (segment[0] === '{' && segment[segment.length - 1] === '}') {
			segment = 'by' + segment[1].toUpperCase() + segment.substring(2, segment.length - 1);
		}
		result.push(segment);
	});
	const result = _.camelCase(segments.join('-'));
	return m.toLowerCase() + result[0].toUpperCase() + result.substring(1);
};

exports.satisfies = function (version, range) {
	if (!version) {
		return false;
	}

	if (version.split('.').length <= 2) {
		version += '.0';
	}

	return version && semver.satisfies(version, range);
};

exports.sanitizeName = function (name) {
	// NOTE: performance wise, we should have written with 2 replaceAll to replace desired
	// character with _ or empty character. Below aims to spell out different cases we've
	// encountered so far and hopefully make it easier for others to add more special
	// cases in the future.

	// better error handling when map/array type is invalid
	if (_.isNil(name)) {
		console.error("String to be sanitized is null. Default to ERROR_UNKNOWN");
		return "ERROR_UNKNOWN";
	}

	// if the name is just '$', map it to 'value' for the time being.
	if ("$" === name) {
		return "value";
	}

	// input[] => input
	name = name.replace(/\[]/g, ""); // FIXME: a parameter should not be assigned. Also declare the methods parameters as 'final'.

	// input[a][b] => input_a_b
	name = name.replace(/\[/g, "_");
	name = name.replace(/]/g, "");

	// input(a)(b) => input_a_b
	name = name.replace(/\(/g, "_");
	name = name.replace(/\)/g, "");

	// input.name => input_name
	name = name.replace(/\./g, "_");

	// input-name => input_name
	name = name.replace(/-/g, "_");

	// input name and age => input_name_and_age
	name = name.replace(/ /g, "_");

	// remove everything else other than word, number and _
	// $php_variable => php_variable
	return name.replace(/[^a-zA-Z0-9_]/g, "");
};

const REG_PROTO = /prototype\$(__)?([a-zA-Z\-]+)(__([a-zA-Z\-]+))?/;
const REG_BYID = /([a-zA-Z]+)ById/;
const REG_VIA = /([a-zA-Z\-]+)__(get|head|put|post|delete|options)_([a-zA-Z]+)/;

exports.processMethodName = function (name) {
	if (REG_PROTO.test(name)) {
		let matches = REG_PROTO.exec(name);
		let op = matches[2];
		let target = matches[4];
		let by = '';
		if (REG_BYID.test(op)) {
			matches = REG_BYID.exec(op);
			op = matches[1];
			by = 'ById';
		}
		return op + _.upperFirst(target) + by;
	}
	if (REG_VIA.test(name)) {
		let matches = REG_VIA.exec(name);
		let op = matches[1];
		let method = matches[2];
		if (['get', 'put'].includes(method)) {
			return op;
		}
		return op + 'Via' + _.upperFirst(method);
	}
	return name;
};
