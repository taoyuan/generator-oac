/*jshint -W069 */
"use strict";
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    return define(['superagent'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS-like environments that support module.exports, like Node.
    return module.exports = factory(require(typeof window === "object" ? 'superagent/lib/client' : 'superagent'));
  } else {
    // Browser globals (root is window)
    if (!root.Client) {
      root.Client = {};
    }
    return root.Client = factory(root.superagent);
  }
}(this, function(superagent) {

  function Client(options) {
    if (!(this instanceof Client)) {
      return new Client(options);
    }

    this.Client = Client;

    const that = this;

    // Requestor definition
    const Requestor = (function(superagent) {
      /**
       * @module Requestor
       * @version 1.0.0
       */

      /**
       * Manages low level client-server communications, parameter marshalling, etc. There should not be any need for an
       * application to use this class directly - the *Api and model classes provide the public API for the service. The
       * contents of this file should be regarded as internal but are documented for completeness.
       * @alias module:Requestor
       * @class
       */
      function Requestor() {

        /**
         * The base URL against which to resolve every API call's (relative) path.
         * @type {String}
         * @default http://localhost/rest/v1
         */
        this.baseUrl = 'http://localhost/rest/v1';

        /**
         * The authentication methods to be included for all API calls.
         * @type {Array.<String>}
         */
        this.authentications = {};
        /**
         * The default HTTP headers to be included for all API calls.
         * @type {Array.<String>}
         * @default {}
         */
        this.defaultHeaders = {};

        /**
         * The default HTTP timeout for all API calls.
         * @type {Number}
         * @default 60000
         */
        this.timeout = 60000;
      }

      if (global.Promise) {
        Requestor.Promise = global.Promise;
      }

      Requestor.prototype.configure = function(options) {
        if (typeof options === 'string') {
          options = {
            baseUrl: options
          };
        }
        options = options || {};

        if (options.baseUrl) {
          this.baseUrl = options.baseUrl;
        }
      };

      Requestor.prototype.auth = function(name, data) {
        if (typeof name === 'object') {
          data = name;
          name = null;
        }
        name = name || 'default';

        if (!data) {
          throw new Error('Authentication data is required');
        }

        if (!data.type) {
          if (data.username) {
            data.type = 'basic';
          } else if (data.apiKey) {
            data.type = 'api';
          } else if (data.accessToken) {
            data.type = 'oauth2';
          } else {
            throw new Error('Unknown authentication data: ' + data);
          }
        }

        this.authentications[name] = data;
      };

      Requestor.prototype.removeAuth = function(name) {
        name = name || 'default';
        delete this.authentications[name];
      };

      /**
       * Returns a string representation for an actual parameter.
       * @param param The actual parameter.
       * @returns {String} The string representation of <code>param</code>.
       */
      Requestor.prototype.paramToString = function(param) {
        if (param == undefined || param == null) {
          return '';
        }
        if (param instanceof Date) {
          return param.toJSON();
        }
        if (typeof param === 'object') {
          return JSON.stringify(param);
        }
        return param.toString();
      };

      /**
       * Builds full URL by appending the given path to the base URL and replacing path parameter place-holders with parameter values.
       * NOTE: query parameters are not handled here.
       * @param {String} path The path to append to the base URL.
       * @param {Object} pathParams The parameter values to append.
       * @returns {String} The encoded path with parameter values substituted.
       */
      Requestor.prototype.buildUrl = function(path, pathParams) {
        if (!path.match(/^\//)) {
          path = '/' + path;
        }
        var url = this.baseUrl + path;
        var that = this;
        url = url.replace(/\{([\w-]+)\}/g, function(fullMatch, key) {
          var value;
          if (pathParams.hasOwnProperty(key)) {
            value = that.paramToString(pathParams[key]);
          } else {
            value = fullMatch;
          }
          return encodeURIComponent(value);
        });
        return url;
      };

      /**
       * Checks whether the given content type represents JSON.<br>
       * JSON content type examples:<br>
       * <ul>
       * <li>application/json</li>
       * <li>application/json; charset=UTF8</li>
       * <li>APPLICATION/JSON</li>
       * </ul>
       * @param {String} contentType The MIME content type to check.
       * @returns {Boolean} <code>true</code> if <code>contentType</code> represents JSON, otherwise <code>false</code>.
       */
      Requestor.prototype.isJsonMime = function(contentType) {
        return Boolean(contentType != null && contentType.match(/^application\/json(;.*)?$/i));
      };

      /**
       * Chooses a content type from the given array, with JSON preferred; i.e. return JSON if included, otherwise return the first.
       * @param {Array.<String>} contentTypes
       * @returns {String} The chosen content type, preferring JSON.
       */
      Requestor.prototype.jsonPreferredMime = function(contentTypes) {
        for (var i = 0; i < contentTypes.length; i++) {
          if (this.isJsonMime(contentTypes[i])) {
            return contentTypes[i];
          }
        }
        return contentTypes[0];
      };

      /**
       * Chooses a content type from the given array, with 'reg' matched; i.e. return JSON for /json/ if included, otherwise return the first.
       * @param {Array.<String>} contentTypes
       * @param {RegExp} reg
       * @returns {String} The chosen content type, preferring 'reg' matched.
       */
      Requestor.prototype.preferredMime = function(contentTypes, reg) {
        if (reg instanceof RegExp) {
          for (var i = 0; i < contentTypes.length; i++) {
            if (reg.test(contentTypes[i])) {
              return contentTypes[i];
            }
          }
        }

        return contentTypes[0];
      };

      /**
       * Checks whether the given parameter value represents file-like content.
       * @param param The parameter to check.
       * @returns {Boolean} <code>true</code> if <code>param</code> represents a file.
       */
      Requestor.prototype.isFileParam = function(param) {
        if (!param || typeof param !== 'object') {
          return false;
        }

        // fs.ReadStream
        if (
          typeof window === 'undefined' &&
          typeof require === 'function' &&
          typeof param.read === 'function' &&
          typeof param.end === 'function' &&
          typeof param.bytesRead === 'number'
        ) {
          return true;
        }
        // Buffer in Node.js (avoid webpack to pack Buffer)
        // if (typeof Buffer === 'function' && param instanceof Buffer) {
        if (
          param.constructor && typeof param.constructor.isBuffer === 'function' &&
          param.constructor.isBuffer(param)
        ) {
          return true;
        }
        // Blob in browser
        if (typeof Blob === 'function' && param instanceof Blob) {
          return true;
        }
        // File in browser (it seems File object is also instance of Blob, but keep this for safe)
        if (typeof File === 'function' && param instanceof File) {
          return true;
        }

        return false;
      };

      /**
       * Normalizes parameter values:
       * <ul>
       * <li>remove nils</li>
       * <li>keep files and arrays</li>
       * <li>format to string with `paramToString` for other cases</li>
       * </ul>
       * @param {Object.<String, Object>} params The parameters as object properties.
       * @returns {Object.<String, Object>} normalized parameters.
       */
      Requestor.prototype.normalizeParams = function(params) {
        var newParams = {};
        for (var key in params) {
          if (params.hasOwnProperty(key) && params[key] != undefined && params[key] != null) {
            var value = params[key];
            if (this.isFileParam(value) || Array.isArray(value)) {
              newParams[key] = value;
            } else {
              newParams[key] = this.paramToString(value);
            }
          }
        }
        return newParams;
      };

      /**
       * Enumeration of collection format separator strategies.
       * @enum {String}
       * @readonly
       */
      Requestor.CollectionFormatEnum = {
        /**
         * Comma-separated values. Value: <code>csv</code>
         * @const
         */
        CSV: ',',
        /**
         * Space-separated values. Value: <code>ssv</code>
         * @const
         */
        SSV: ' ',
        /**
         * Tab-separated values. Value: <code>tsv</code>
         * @const
         */
        TSV: '\t',
        /**
         * Pipe(|)-separated values. Value: <code>pipes</code>
         * @const
         */
        PIPES: '|',
        /**
         * Native array. Value: <code>multi</code>
         * @const
         */
        MULTI: 'multi'
      };

      /**
       * Builds a string representation of an array-type actual parameter, according to the given collection format.
       * @param {Array} param An array parameter.
       * @param {module:Requestor.CollectionFormatEnum} collectionFormat The array element separator strategy.
       * @returns {String|Array} A string representation of the supplied collection, using the specified delimiter. Returns
       * <code>param</code> as is if <code>collectionFormat</code> is <code>multi</code>.
       */
      Requestor.prototype.buildCollectionParam = function buildCollectionParam(param, collectionFormat) {
        if (param == null) {
          return null;
        }
        switch (collectionFormat) {
          case 'csv':
            return param.map(this.paramToString).join(',');
          case 'ssv':
            return param.map(this.paramToString).join(' ');
          case 'tsv':
            return param.map(this.paramToString).join('\t');
          case 'pipes':
            return param.map(this.paramToString).join('|');
          case 'multi':
            // return the array directly as SuperAgent will handle it as expected
            return param.map(this.paramToString);
          default:
            throw new Error('Unknown collection format: ' + collectionFormat);
        }
      };

      /**
       * Applies authentication headers to the request.
       * @param {Object} request The request object created by a <code>superagent()</code> call.
       * @param {Array.<String>} authNames An array of authentication method names.
       */
      Requestor.prototype.applyAuthToRequest = function(request, authNames) {
        var that = this;
        if (!authNames || !authNames.length) {
          authNames = ['default'];
        }
        authNames.forEach(function(authName) {
          var auth = that.authentications[authName];
          if (!auth) return;
          var data = {};
          switch (auth.type) {
            case 'basic':
              if (auth.username || auth.password) {
                request.auth(auth.username || '', auth.password || '');
              }
              break;
            case 'apiKey':
              if (auth.apiKey) {
                if (auth.apiKeyPrefix) {
                  data[auth.name] = auth.apiKeyPrefix + ' ' + auth.apiKey;
                } else {
                  data[auth.name] = auth.apiKey;
                }
                if (auth['in'] === 'query') {
                  request.query(data);
                } else {
                  request.set(data);
                }
              }
              break;
            case 'oauth2':
              if (auth.accessToken) {
                if (auth.name) {
                  data[auth.name] = auth.accessToken;
                  if (auth['in'] === 'query') {
                    request.query(data);
                  } else {
                    request.set(data);
                  }
                } else {
                  request.set({
                    'Authorization': 'Bearer ' + auth.accessToken
                  });
                }
              }
              break;
            default:
              throw new Error('Unknown authentication type: ' + auth.type);
          }
        });
      };

      /**
       * Deserializes an HTTP response body into a value of the specified type.
       * @param {Object} response A SuperAgent response object.
       * @param {(String|Array.<String>|Object.<String, Object>|Function)} returnType The type to return. Pass a string for simple types
       * or the constructor function for a complex type. Pass an array containing the type name to return an array of that type. To
       * return an object, pass an object with one property whose name is the key type and whose value is the corresponding value type:
       * all properties on <code>data<code> will be converted to this type.
       * @returns A value of the specified type.
       */
      Requestor.prototype.deserialize = function deserialize(response, returnType) {
        if (response == null || returnType == null) {
          return null;
        }
        // Rely on SuperAgent for parsing response body.
        // See http://visionmedia.github.io/superagent/#parsing-response-bodies
        var data = response.body;
        if (data == null) {
          // SuperAgent does not always produce a body; use the unparsed response as a fallback
          data = response.text;
        }
        return Requestor.convertToType(data, returnType);
      };

      /**
       * Parses an ISO-8601 string representation of a date value.
       * @param {String} str The date value as a string.
       * @returns {Date} The parsed date object.
       */
      Requestor.parseDate = function(str) {
        return new Date(str.replace(/T/i, ' '));
      };

      /**
       * Converts a value to the specified type.
       * @param {(String|Object)} data The data to convert, as a string or object.
       * @param {(String|Array.<String>|Object.<String, Object>|Function)} type The type to return. Pass a string for simple types
       * or the constructor function for a complex type. Pass an array containing the type name to return an array of that type. To
       * return an object, pass an object with one property whose name is the key type and whose value is the corresponding value type:
       * all properties on <code>data<code> will be converted to this type.
       * @returns An instance of the specified type.
       */
      Requestor.convertToType = function(data, type) {
        switch (type) {
          case 'Boolean':
            return Boolean(data);
          case 'Integer':
            return parseInt(data, 10);
          case 'Number':
            return parseFloat(data);
          case 'String':
            return String(data);
          case 'Date':
            return this.parseDate(String(data));
          default:
            if (type === Object) {
              // generic object, return directly
              return data;
            } else if (typeof type === 'function') {
              // for model type like: User
              return type.create(data);
            } else if (Array.isArray(type)) {
              // for array type like: ['String']
              var itemType = type[0];
              return data.map(function(item) {
                return Requestor.convertToType(item, itemType);
              });
            } else if (typeof type === 'object') {
              // for plain object type like: {'String': 'Integer'}
              var keyType, valueType;
              for (var k in type) {
                if (type.hasOwnProperty(k)) {
                  keyType = k;
                  valueType = type[k];
                  break;
                }
              }
              var result = {};
              for (var k in data) {
                if (data.hasOwnProperty(k)) {
                  var key = Requestor.convertToType(k, keyType);
                  var value = Requestor.convertToType(data[k], valueType);
                  result[key] = value;
                }
              }
              return result;
            } else {
              // for unknown type, return the data directly
              return data;
            }
        }
      };

      /**
       * Constructs a new map or array model from REST data.
       * @param data {Object|Array} The REST data.
       * @param obj {Object|Array} The target object or array.
       */
      Requestor.create = function(data, obj, itemType) {
        if (Array.isArray(data)) {
          for (var i = 0; i < data.length; i++) {
            if (data.hasOwnProperty(i))
              obj[i] = Requestor.convertToType(data[i], itemType);
          }
        } else {
          for (var k in data) {
            if (data.hasOwnProperty(k))
              obj[k] = Requestor.convertToType(data[k], itemType);
          }
        }
      };

      /**
       * Callback function to receive the result of the operation.
       * @callback module:Requestor~callApiCallback
       * @param {String} error Error message, if any.
       * @param data The data returned by the service call.
       * @param {String} response The complete HTTP response.
       */

      /**
       * Invokes the REST service using the supplied settings and parameters.
       * @param {String} path The base URL to invoke.
       * @param {String} httpMethod The HTTP method to use.
       * @param {Object.<String, String>} pathParams A map of path parameters and their values.
       * @param {Object.<String, Object>} queryParams A map of query parameters and their values.
       * @param {Object.<String, Object>} headerParams A map of header parameters and their values.
       * @param {Object.<String, Object>} formParams A map of form parameters and their values.
       * @param {Object} bodyParam The value to pass as the request body.
       * @param {Array.<String>} authNames An array of authentication type names.
       * @param {Array.<String>} contentTypes An array of request MIME types.
       * @param {Array.<String>} accepts An array of acceptable response MIME types.
       * @param {(String|Array|ObjectFunction)} returnType The required type to return; can be a string for simple types or the
       * constructor for a complex type.
       * @param {module:Requestor~requestCallback} callback The callback function.
       * @returns {Object} The SuperAgent request object.
       */
      Requestor.prototype.request = function(path, httpMethod, pathParams,
        queryParams, headerParams, formParams, bodyParam, authNames, contentTypes, accepts,
        returnType, callback) {

        var that = this;
        var url = this.buildUrl(path, pathParams);
        var request = superagent(httpMethod, url);

        // apply authentications
        this.applyAuthToRequest(request, authNames);

        // set query parameters
        request.query(this.normalizeParams(queryParams));

        // set header parameters
        request.set(this.defaultHeaders).set(this.normalizeParams(headerParams));

        // set request timeout
        request.timeout(this.timeout);

        var contentType = this.preferredMime(contentTypes, bodyParam ? /json/ : /form/);
        if (contentType) {
          request.type(contentType);
        } else if (!request.header['Content-Type']) {
          request.type('application/json');
        }

        if (contentType === 'application/x-www-form-urlencoded') {
          request.send(this.normalizeParams(formParams));
        } else if (contentType == 'multipart/form-data') {
          var _formParams = this.normalizeParams(formParams);
          for (var key in _formParams) {
            if (_formParams.hasOwnProperty(key)) {
              if (this.isFileParam(_formParams[key])) {
                // file field
                request.attach(key, _formParams[key]);
              } else {
                request.field(key, _formParams[key]);
              }
            }
          }
        } else if (bodyParam) {
          request.send(bodyParam);
        }

        var accept = this.jsonPreferredMime(accepts);
        if (accept) {
          request.accept(accept);
        }

        function fetch(done) {
          return request.end(function(err, res) {
            if (!err) {
              res.data = that.deserialize(res, returnType);
            }
            if (done) {
              done(err, res);
            }
          });
        }

        if (Requestor.Promise) {
          return new Requestor.Promise(function(resolve, reject) {
            fetch(function(err, res) {
              if (callback) {
                callback(err, res);
              }
              if (err) {
                reject(err);
              } else {
                resolve(res);
              }
            });
          });
        } else {
          fetch(callback);
        }
      };

      /**
       * The default API client implementation.
       * @type {module:Requestor}
       */
      Requestor.instance = new Requestor();

      return Requestor;
    })(superagent);
    const requestor = new Requestor();

    this.Requestor = Requestor;
    this.requestor = requestor;

    Object.keys(requestor).concat(Object.keys(Requestor.prototype)).forEach(function(name) {
      if (typeof requestor[name] === 'function') {
        that[name] = function() {
          return requestor[name].apply(requestor, arguments);
        }
      }
    });

    Object.defineProperty(that, 'Promise', {
      get: function() {
        return Requestor.Promise;
      },
      set: function(value) {
        Requestor.Promise = value;
      }
    });

    options && that.configure(options);

    // Models definitions
    const models = {};
    models['AccessToken'] = (function(Requestor, _requestor) {

      /**
       * The AccessToken model module.
       * @module model/AccessToken
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>AccessToken</code>.
       * @alias module:model/AccessToken
       * @class
       */
      function AccessToken() {

      }

      /**
       * Constructs a <code>AccessToken</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/AccessToken } obj Optional instance to populate.
       * @return {module:model/AccessToken } The populated <code>AccessToken</code> instance.
       */
      AccessToken.create = function(data, obj) {
        if (data) {
          obj = obj || new AccessToken();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('ttl')) {
            obj['ttl'] = Requestor.convertToType(data['ttl'], 'Number');
          }
          if (data.hasOwnProperty('created')) {
            obj['created'] = Requestor.convertToType(data['created'], 'String');
          }
          if (data.hasOwnProperty('userId')) {
            obj['userId'] = Requestor.convertToType(data['userId'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      AccessToken.prototype['id'] = undefined;
      /**
       * time to live in seconds (2 weeks by default)
       * @member { Number } ttl
       */
      AccessToken.prototype['ttl'] = undefined;
      /**
       * 
       * @member { String } created
       */
      AccessToken.prototype['created'] = undefined;
      /**
       * 
       * @member { String } userId
       */
      AccessToken.prototype['userId'] = undefined;

      return AccessToken;
    })(Requestor, requestor);
    models['Repo'] = (function(Requestor, _requestor) {

      /**
       * The Repo model module.
       * @module model/Repo
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Repo</code>.
       * @alias module:model/Repo
       * @class
       */
      function Repo() {

      }

      /**
       * Constructs a <code>Repo</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Repo } obj Optional instance to populate.
       * @return {module:model/Repo } The populated <code>Repo</code> instance.
       */
      Repo.create = function(data, obj) {
        if (data) {
          obj = obj || new Repo();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('description')) {
            obj['description'] = Requestor.convertToType(data['description'], 'String');
          }
          if (data.hasOwnProperty('private')) {
            obj['private'] = Requestor.convertToType(data['private'], 'Boolean');
          }
          if (data.hasOwnProperty('ownerId')) {
            obj['ownerId'] = Requestor.convertToType(data['ownerId'], 'String');
          }
          if (data.hasOwnProperty('ownerType')) {
            obj['ownerType'] = Requestor.convertToType(data['ownerType'], 'String');
          }
          if (data.hasOwnProperty('createdAt')) {
            obj['createdAt'] = Requestor.convertToType(data['createdAt'], 'String');
          }
          if (data.hasOwnProperty('updatedAt')) {
            obj['updatedAt'] = Requestor.convertToType(data['updatedAt'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Repo.prototype['id'] = undefined;
      /**
       * 
       * @member { String } name
       */
      Repo.prototype['name'] = undefined;
      /**
       * 
       * @member { String } description
       */
      Repo.prototype['description'] = undefined;
      /**
       * 
       * @member { Boolean } private
       */
      Repo.prototype['private'] = undefined;
      /**
       * 
       * @member { String } ownerId
       */
      Repo.prototype['ownerId'] = undefined;
      /**
       * 
       * @member { String } ownerType
       */
      Repo.prototype['ownerType'] = undefined;
      /**
       * 
       * @member { String } createdAt
       */
      Repo.prototype['createdAt'] = undefined;
      /**
       * 
       * @member { String } updatedAt
       */
      Repo.prototype['updatedAt'] = undefined;

      return Repo;
    })(Requestor, requestor);
    models['Namespace'] = (function(Requestor, _requestor) {

      /**
       * The Namespace model module.
       * @module model/Namespace
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Namespace</code>.
       * @alias module:model/Namespace
       * @class
       */
      function Namespace() {

      }

      /**
       * Constructs a <code>Namespace</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Namespace } obj Optional instance to populate.
       * @return {module:model/Namespace } The populated <code>Namespace</code> instance.
       */
      Namespace.create = function(data, obj) {
        if (data) {
          obj = obj || new Namespace();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('description')) {
            obj['description'] = Requestor.convertToType(data['description'], 'String');
          }
          if (data.hasOwnProperty('avatar')) {
            obj['avatar'] = Requestor.convertToType(data['avatar'], 'String');
          }
          if (data.hasOwnProperty('ownerId')) {
            obj['ownerId'] = Requestor.convertToType(data['ownerId'], 'String');
          }
          if (data.hasOwnProperty('ownerType')) {
            obj['ownerType'] = Requestor.convertToType(data['ownerType'], 'String');
          }
          if (data.hasOwnProperty('createdAt')) {
            obj['createdAt'] = Requestor.convertToType(data['createdAt'], 'String');
          }
          if (data.hasOwnProperty('updatedAt')) {
            obj['updatedAt'] = Requestor.convertToType(data['updatedAt'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Namespace.prototype['id'] = undefined;
      /**
       * 
       * @member { String } name
       */
      Namespace.prototype['name'] = undefined;
      /**
       * 
       * @member { String } description
       */
      Namespace.prototype['description'] = undefined;
      /**
       * 
       * @member { String } avatar
       */
      Namespace.prototype['avatar'] = undefined;
      /**
       * 
       * @member { String } ownerId
       */
      Namespace.prototype['ownerId'] = undefined;
      /**
       * 
       * @member { String } ownerType
       */
      Namespace.prototype['ownerType'] = undefined;
      /**
       * 
       * @member { String } createdAt
       */
      Namespace.prototype['createdAt'] = undefined;
      /**
       * 
       * @member { String } updatedAt
       */
      Namespace.prototype['updatedAt'] = undefined;

      return Namespace;
    })(Requestor, requestor);
    models['Account'] = (function(Requestor, _requestor) {

      /**
       * The Account model module.
       * @module model/Account
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Account</code>.
       * @alias module:model/Account
       * @class
       */
      function Account() {

      }

      /**
       * Constructs a <code>Account</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Account } obj Optional instance to populate.
       * @return {module:model/Account } The populated <code>Account</code> instance.
       */
      Account.create = function(data, obj) {
        if (data) {
          obj = obj || new Account();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('username')) {
            obj['username'] = Requestor.convertToType(data['username'], 'String');
          }
          if (data.hasOwnProperty('email')) {
            obj['email'] = Requestor.convertToType(data['email'], 'String');
          }
          if (data.hasOwnProperty('mobile')) {
            obj['mobile'] = Requestor.convertToType(data['mobile'], 'String');
          }
          if (data.hasOwnProperty('fullname')) {
            obj['fullname'] = Requestor.convertToType(data['fullname'], 'String');
          }
          if (data.hasOwnProperty('gender')) {
            obj['gender'] = Requestor.convertToType(data['gender'], 'String');
          }
          if (data.hasOwnProperty('birthday')) {
            obj['birthday'] = Requestor.convertToType(data['birthday'], 'String');
          }
          if (data.hasOwnProperty('profile')) {
            obj['profile'] = Requestor.convertToType(data['profile'], 'Object');
          }
          if (data.hasOwnProperty('enabled')) {
            obj['enabled'] = Requestor.convertToType(data['enabled'], 'Boolean');
          }
          if (data.hasOwnProperty('realm')) {
            obj['realm'] = Requestor.convertToType(data['realm'], 'String');
          }
          if (data.hasOwnProperty('emailVerified')) {
            obj['emailVerified'] = Requestor.convertToType(data['emailVerified'], 'Boolean');
          }
          if (data.hasOwnProperty('avatar')) {
            obj['avatar'] = Requestor.convertToType(data['avatar'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Account.prototype['id'] = undefined;
      /**
       * 
       * @member { String } username
       */
      Account.prototype['username'] = undefined;
      /**
       * 
       * @member { String } email
       */
      Account.prototype['email'] = undefined;
      /**
       * 
       * @member { String } mobile
       */
      Account.prototype['mobile'] = undefined;
      /**
       * 
       * @member { String } fullname
       */
      Account.prototype['fullname'] = undefined;
      /**
       * 
       * @member { String } gender
       */
      Account.prototype['gender'] = undefined;
      /**
       * 
       * @member { String } birthday
       */
      Account.prototype['birthday'] = undefined;
      /**
       * 
       * @member { Object } profile
       */
      Account.prototype['profile'] = undefined;
      /**
       * 
       * @member { Boolean } enabled
       */
      Account.prototype['enabled'] = undefined;
      /**
       * 
       * @member { String } realm
       */
      Account.prototype['realm'] = undefined;
      /**
       * 
       * @member { Boolean } emailVerified
       */
      Account.prototype['emailVerified'] = undefined;
      /**
       * 
       * @member { String } avatar
       */
      Account.prototype['avatar'] = undefined;

      return Account;
    })(Requestor, requestor);
    models['Team'] = (function(Requestor, _requestor) {

      /**
       * The Team model module.
       * @module model/Team
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Team</code>.
       * @alias module:model/Team
       * @class
       */
      function Team() {

      }

      /**
       * Constructs a <code>Team</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Team } obj Optional instance to populate.
       * @return {module:model/Team } The populated <code>Team</code> instance.
       */
      Team.create = function(data, obj) {
        if (data) {
          obj = obj || new Team();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('orgId')) {
            obj['orgId'] = Requestor.convertToType(data['orgId'], 'String');
          }
          if (data.hasOwnProperty('enabled')) {
            obj['enabled'] = Requestor.convertToType(data['enabled'], 'Boolean');
          }
          if (data.hasOwnProperty('avatar')) {
            obj['avatar'] = Requestor.convertToType(data['avatar'], 'String');
          }
          if (data.hasOwnProperty('createdAt')) {
            obj['createdAt'] = Requestor.convertToType(data['createdAt'], 'String');
          }
          if (data.hasOwnProperty('updatedAt')) {
            obj['updatedAt'] = Requestor.convertToType(data['updatedAt'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Team.prototype['id'] = undefined;
      /**
       * 
       * @member { String } name
       */
      Team.prototype['name'] = undefined;
      /**
       * 
       * @member { String } orgId
       */
      Team.prototype['orgId'] = undefined;
      /**
       * 
       * @member { Boolean } enabled
       */
      Team.prototype['enabled'] = undefined;
      /**
       * 
       * @member { String } avatar
       */
      Team.prototype['avatar'] = undefined;
      /**
       * 
       * @member { String } createdAt
       */
      Team.prototype['createdAt'] = undefined;
      /**
       * 
       * @member { String } updatedAt
       */
      Team.prototype['updatedAt'] = undefined;

      return Team;
    })(Requestor, requestor);
    models['Org'] = (function(Requestor, _requestor) {

      /**
       * The Org model module.
       * @module model/Org
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Org</code>.
       * @alias module:model/Org
       * @class
       */
      function Org() {

      }

      /**
       * Constructs a <code>Org</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Org } obj Optional instance to populate.
       * @return {module:model/Org } The populated <code>Org</code> instance.
       */
      Org.create = function(data, obj) {
        if (data) {
          obj = obj || new Org();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('enabled')) {
            obj['enabled'] = Requestor.convertToType(data['enabled'], 'Boolean');
          }
          if (data.hasOwnProperty('avatar')) {
            obj['avatar'] = Requestor.convertToType(data['avatar'], 'String');
          }
          if (data.hasOwnProperty('createdAt')) {
            obj['createdAt'] = Requestor.convertToType(data['createdAt'], 'String');
          }
          if (data.hasOwnProperty('updatedAt')) {
            obj['updatedAt'] = Requestor.convertToType(data['updatedAt'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Org.prototype['id'] = undefined;
      /**
       * 
       * @member { String } name
       */
      Org.prototype['name'] = undefined;
      /**
       * 
       * @member { Boolean } enabled
       */
      Org.prototype['enabled'] = undefined;
      /**
       * 
       * @member { String } avatar
       */
      Org.prototype['avatar'] = undefined;
      /**
       * 
       * @member { String } createdAt
       */
      Org.prototype['createdAt'] = undefined;
      /**
       * 
       * @member { String } updatedAt
       */
      Org.prototype['updatedAt'] = undefined;

      return Org;
    })(Requestor, requestor);
    models['PersistedModel'] = (function(Requestor, _requestor) {

      /**
       * The PersistedModel model module.
       * @module model/PersistedModel
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>PersistedModel</code>.
       * @alias module:model/PersistedModel
       * @class
       */
      function PersistedModel() {

      }

      /**
       * Constructs a <code>PersistedModel</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/PersistedModel } obj Optional instance to populate.
       * @return {module:model/PersistedModel } The populated <code>PersistedModel</code> instance.
       */
      PersistedModel.create = function(data, obj) {
        if (data) {
          obj = obj || new PersistedModel();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'Number');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { Number } id
       */
      PersistedModel.prototype['id'] = undefined;

      return PersistedModel;
    })(Requestor, requestor);
    models['Form'] = (function(Requestor, _requestor) {

      /**
       * The Form model module.
       * @module model/Form
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Form</code>.
       * @alias module:model/Form
       * @class
       */
      function Form() {

      }

      /**
       * Constructs a <code>Form</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Form } obj Optional instance to populate.
       * @return {module:model/Form } The populated <code>Form</code> instance.
       */
      Form.create = function(data, obj) {
        if (data) {
          obj = obj || new Form();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('definition')) {
            obj['definition'] = Requestor.convertToType(data['definition'], 'Object');
          }
          if (data.hasOwnProperty('ownerId')) {
            obj['ownerId'] = Requestor.convertToType(data['ownerId'], 'String');
          }
          if (data.hasOwnProperty('ownerType')) {
            obj['ownerType'] = Requestor.convertToType(data['ownerType'], 'String');
          }
          if (data.hasOwnProperty('createdAt')) {
            obj['createdAt'] = Requestor.convertToType(data['createdAt'], 'String');
          }
          if (data.hasOwnProperty('updatedAt')) {
            obj['updatedAt'] = Requestor.convertToType(data['updatedAt'], 'String');
          }
          if (data.hasOwnProperty('repoId')) {
            obj['repoId'] = Requestor.convertToType(data['repoId'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Form.prototype['id'] = undefined;
      /**
       * 
       * @member { String } name
       */
      Form.prototype['name'] = undefined;
      /**
       * 
       * @member { Object } definition
       */
      Form.prototype['definition'] = undefined;
      /**
       * 
       * @member { String } ownerId
       */
      Form.prototype['ownerId'] = undefined;
      /**
       * 
       * @member { String } ownerType
       */
      Form.prototype['ownerType'] = undefined;
      /**
       * 
       * @member { String } createdAt
       */
      Form.prototype['createdAt'] = undefined;
      /**
       * 
       * @member { String } updatedAt
       */
      Form.prototype['updatedAt'] = undefined;
      /**
       * 
       * @member { String } repoId
       */
      Form.prototype['repoId'] = undefined;

      return Form;
    })(Requestor, requestor);
    models['Page'] = (function(Requestor, _requestor) {

      /**
       * The Page model module.
       * @module model/Page
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Page</code>.
       * @alias module:model/Page
       * @class
       */
      function Page() {

      }

      /**
       * Constructs a <code>Page</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Page } obj Optional instance to populate.
       * @return {module:model/Page } The populated <code>Page</code> instance.
       */
      Page.create = function(data, obj) {
        if (data) {
          obj = obj || new Page();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('orgId')) {
            obj['orgId'] = Requestor.convertToType(data['orgId'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('type')) {
            obj['type'] = Requestor.convertToType(data['type'], 'String');
          }
          if (data.hasOwnProperty('description')) {
            obj['description'] = Requestor.convertToType(data['description'], 'String');
          }
          if (data.hasOwnProperty('items')) {
            obj['items'] = Requestor.convertToType(data['items'], 'Object');
          }
          if (data.hasOwnProperty('public')) {
            obj['public'] = Requestor.convertToType(data['public'], 'Boolean');
          }
          if (data.hasOwnProperty('ownerId')) {
            obj['ownerId'] = Requestor.convertToType(data['ownerId'], 'String');
          }
          if (data.hasOwnProperty('ownerType')) {
            obj['ownerType'] = Requestor.convertToType(data['ownerType'], 'String');
          }
          if (data.hasOwnProperty('createdAt')) {
            obj['createdAt'] = Requestor.convertToType(data['createdAt'], 'String');
          }
          if (data.hasOwnProperty('updatedAt')) {
            obj['updatedAt'] = Requestor.convertToType(data['updatedAt'], 'String');
          }
          if (data.hasOwnProperty('repoId')) {
            obj['repoId'] = Requestor.convertToType(data['repoId'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Page.prototype['id'] = undefined;
      /**
       * 
       * @member { String } orgId
       */
      Page.prototype['orgId'] = undefined;
      /**
       * 
       * @member { String } name
       */
      Page.prototype['name'] = undefined;
      /**
       * 
       * @member { String } type
       */
      Page.prototype['type'] = undefined;
      /**
       * 
       * @member { String } description
       */
      Page.prototype['description'] = undefined;
      /**
       * 
       * @member { Object } items
       */
      Page.prototype['items'] = undefined;
      /**
       * 
       * @member { Boolean } public
       */
      Page.prototype['public'] = undefined;
      /**
       * 
       * @member { String } ownerId
       */
      Page.prototype['ownerId'] = undefined;
      /**
       * 
       * @member { String } ownerType
       */
      Page.prototype['ownerType'] = undefined;
      /**
       * 
       * @member { String } createdAt
       */
      Page.prototype['createdAt'] = undefined;
      /**
       * 
       * @member { String } updatedAt
       */
      Page.prototype['updatedAt'] = undefined;
      /**
       * 
       * @member { String } repoId
       */
      Page.prototype['repoId'] = undefined;

      return Page;
    })(Requestor, requestor);
    models['Report'] = (function(Requestor, _requestor) {

      /**
       * The Report model module.
       * @module model/Report
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Report</code>.
       * @alias module:model/Report
       * @class
       */
      function Report() {

      }

      /**
       * Constructs a <code>Report</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Report } obj Optional instance to populate.
       * @return {module:model/Report } The populated <code>Report</code> instance.
       */
      Report.create = function(data, obj) {
        if (data) {
          obj = obj || new Report();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('title')) {
            obj['title'] = Requestor.convertToType(data['title'], 'String');
          }
          if (data.hasOwnProperty('description')) {
            obj['description'] = Requestor.convertToType(data['description'], 'String');
          }
          if (data.hasOwnProperty('scope')) {
            obj['scope'] = Requestor.convertToType(data['scope'], 'String');
          }
          if (data.hasOwnProperty('type')) {
            obj['type'] = Requestor.convertToType(data['type'], 'String');
          }
          if (data.hasOwnProperty('subtype')) {
            obj['subtype'] = Requestor.convertToType(data['subtype'], 'String');
          }
          if (data.hasOwnProperty('properties')) {
            obj['properties'] = Requestor.convertToType(data['properties'], 'Object');
          }
          if (data.hasOwnProperty('query')) {
            obj['query'] = Requestor.convertToType(data['query'], '');
          }
          if (data.hasOwnProperty('history')) {
            obj['history'] = Requestor.convertToType(data['history'], 'Array');
          }
          if (data.hasOwnProperty('published')) {
            obj['published'] = Requestor.convertToType(data['published'], 'String');
          }
          if (data.hasOwnProperty('public')) {
            obj['public'] = Requestor.convertToType(data['public'], 'Boolean');
          }
          if (data.hasOwnProperty('ownerId')) {
            obj['ownerId'] = Requestor.convertToType(data['ownerId'], 'String');
          }
          if (data.hasOwnProperty('ownerType')) {
            obj['ownerType'] = Requestor.convertToType(data['ownerType'], 'String');
          }
          if (data.hasOwnProperty('createdAt')) {
            obj['createdAt'] = Requestor.convertToType(data['createdAt'], 'String');
          }
          if (data.hasOwnProperty('updatedAt')) {
            obj['updatedAt'] = Requestor.convertToType(data['updatedAt'], 'String');
          }
          if (data.hasOwnProperty('repoId')) {
            obj['repoId'] = Requestor.convertToType(data['repoId'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Report.prototype['id'] = undefined;
      /**
       * 
       * @member { String } name
       */
      Report.prototype['name'] = undefined;
      /**
       * 
       * @member { String } title
       */
      Report.prototype['title'] = undefined;
      /**
       * 
       * @member { String } description
       */
      Report.prototype['description'] = undefined;
      /**
       * 
       * @member { String } scope
       */
      Report.prototype['scope'] = undefined;
      /**
       * 
       * @member { String } type
       */
      Report.prototype['type'] = undefined;
      /**
       * 
       * @member { String } subtype
       */
      Report.prototype['subtype'] = undefined;
      /**
       * 
       * @member { Object } properties
       */
      Report.prototype['properties'] = undefined;
      /**
       * 
       * @member {  } query
       */
      Report.prototype['query'] = undefined;
      /**
       * 
       * @member { Array } history
       */
      Report.prototype['history'] = undefined;
      /**
       * 
       * @member { String } published
       */
      Report.prototype['published'] = undefined;
      /**
       * 
       * @member { Boolean } public
       */
      Report.prototype['public'] = undefined;
      /**
       * 
       * @member { String } ownerId
       */
      Report.prototype['ownerId'] = undefined;
      /**
       * 
       * @member { String } ownerType
       */
      Report.prototype['ownerType'] = undefined;
      /**
       * 
       * @member { String } createdAt
       */
      Report.prototype['createdAt'] = undefined;
      /**
       * 
       * @member { String } updatedAt
       */
      Report.prototype['updatedAt'] = undefined;
      /**
       * 
       * @member { String } repoId
       */
      Report.prototype['repoId'] = undefined;

      return Report;
    })(Requestor, requestor);
    models['Layer'] = (function(Requestor, _requestor) {

      /**
       * The Layer model module.
       * @module model/Layer
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Layer</code>.
       * @alias module:model/Layer
       * @class
       */
      function Layer() {

      }

      /**
       * Constructs a <code>Layer</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Layer } obj Optional instance to populate.
       * @return {module:model/Layer } The populated <code>Layer</code> instance.
       */
      Layer.create = function(data, obj) {
        if (data) {
          obj = obj || new Layer();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('description')) {
            obj['description'] = Requestor.convertToType(data['description'], 'String');
          }
          if (data.hasOwnProperty('status')) {
            obj['status'] = Requestor.convertToType(data['status'], 'String');
          }
          if (data.hasOwnProperty('fields')) {
            obj['fields'] = Requestor.convertToType(data['fields'], 'Array');
          }
          if (data.hasOwnProperty('schema')) {
            obj['schema'] = Requestor.convertToType(data['schema'], 'Object');
          }
          if (data.hasOwnProperty('ownerId')) {
            obj['ownerId'] = Requestor.convertToType(data['ownerId'], 'String');
          }
          if (data.hasOwnProperty('ownerType')) {
            obj['ownerType'] = Requestor.convertToType(data['ownerType'], 'String');
          }
          if (data.hasOwnProperty('createdAt')) {
            obj['createdAt'] = Requestor.convertToType(data['createdAt'], 'String');
          }
          if (data.hasOwnProperty('updatedAt')) {
            obj['updatedAt'] = Requestor.convertToType(data['updatedAt'], 'String');
          }
          if (data.hasOwnProperty('repoId')) {
            obj['repoId'] = Requestor.convertToType(data['repoId'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Layer.prototype['id'] = undefined;
      /**
       * 
       * @member { String } name
       */
      Layer.prototype['name'] = undefined;
      /**
       * 
       * @member { String } description
       */
      Layer.prototype['description'] = undefined;
      /**
       * 
       * @member { String } status
       */
      Layer.prototype['status'] = undefined;
      /**
       * 
       * @member { Array } fields
       */
      Layer.prototype['fields'] = undefined;
      /**
       * 
       * @member { Object } schema
       */
      Layer.prototype['schema'] = undefined;
      /**
       * 
       * @member { String } ownerId
       */
      Layer.prototype['ownerId'] = undefined;
      /**
       * 
       * @member { String } ownerType
       */
      Layer.prototype['ownerType'] = undefined;
      /**
       * 
       * @member { String } createdAt
       */
      Layer.prototype['createdAt'] = undefined;
      /**
       * 
       * @member { String } updatedAt
       */
      Layer.prototype['updatedAt'] = undefined;
      /**
       * 
       * @member { String } repoId
       */
      Layer.prototype['repoId'] = undefined;

      return Layer;
    })(Requestor, requestor);
    models['LayerField'] = (function(Requestor, _requestor) {

      /**
       * The LayerField model module.
       * @module model/LayerField
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>LayerField</code>.
       * @alias module:model/LayerField
       * @class
       */
      function LayerField() {

      }

      /**
       * Constructs a <code>LayerField</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/LayerField } obj Optional instance to populate.
       * @return {module:model/LayerField } The populated <code>LayerField</code> instance.
       */
      LayerField.create = function(data, obj) {
        if (data) {
          obj = obj || new LayerField();

          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('label')) {
            obj['label'] = Requestor.convertToType(data['label'], 'String');
          }
          if (data.hasOwnProperty('tags')) {
            obj['tags'] = Requestor.convertToType(data['tags'], 'Array');
          }
          if (data.hasOwnProperty('type')) {
            obj['type'] = Requestor.convertToType(data['type'], 'String');
          }
          if (data.hasOwnProperty('format')) {
            obj['format'] = Requestor.convertToType(data['format'], 'String');
          }
          if (data.hasOwnProperty('lookup')) {
            obj['lookup'] = Requestor.convertToType(data['lookup'], '');
          }
          if (data.hasOwnProperty('values')) {
            obj['values'] = Requestor.convertToType(data['values'], 'Array');
          }
          if (data.hasOwnProperty('expression')) {
            obj['expression'] = Requestor.convertToType(data['expression'], 'String');
          }
          if (data.hasOwnProperty('resourceId')) {
            obj['resourceId'] = Requestor.convertToType(data['resourceId'], 'String');
          }
          if (data.hasOwnProperty('columnName')) {
            obj['columnName'] = Requestor.convertToType(data['columnName'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } name
       */
      LayerField.prototype['name'] = undefined;
      /**
       * 
       * @member { String } label
       */
      LayerField.prototype['label'] = undefined;
      /**
       * 
       * @member { Array } tags
       */
      LayerField.prototype['tags'] = undefined;
      /**
       * 
       * @member { String } type
       */
      LayerField.prototype['type'] = undefined;
      /**
       * 
       * @member { String } format
       */
      LayerField.prototype['format'] = undefined;
      /**
       * 
       * @member {  } lookup
       */
      LayerField.prototype['lookup'] = undefined;
      /**
       * 
       * @member { Array } values
       */
      LayerField.prototype['values'] = undefined;
      /**
       * 
       * @member { String } expression
       */
      LayerField.prototype['expression'] = undefined;
      /**
       * 
       * @member { String } resourceId
       */
      LayerField.prototype['resourceId'] = undefined;
      /**
       * 
       * @member { String } columnName
       */
      LayerField.prototype['columnName'] = undefined;

      return LayerField;
    })(Requestor, requestor);
    models['LayerSchema'] = (function(Requestor, _requestor) {

      /**
       * The LayerSchema model module.
       * @module model/LayerSchema
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>LayerSchema</code>.
       * @alias module:model/LayerSchema
       * @class
       */
      function LayerSchema() {

      }

      /**
       * Constructs a <code>LayerSchema</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/LayerSchema } obj Optional instance to populate.
       * @return {module:model/LayerSchema } The populated <code>LayerSchema</code> instance.
       */
      LayerSchema.create = function(data, obj) {
        if (data) {
          obj = obj || new LayerSchema();

          if (data.hasOwnProperty('resources')) {
            obj['resources'] = Requestor.convertToType(data['resources'], 'Array');
          }
          if (data.hasOwnProperty('joins')) {
            obj['joins'] = Requestor.convertToType(data['joins'], 'Array');
          }
          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'Number');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { Array } resources
       */
      LayerSchema.prototype['resources'] = undefined;
      /**
       * 
       * @member { Array } joins
       */
      LayerSchema.prototype['joins'] = undefined;
      /**
       * 
       * @member { Number } id
       */
      LayerSchema.prototype['id'] = undefined;

      return LayerSchema;
    })(Requestor, requestor);
    models['Connection'] = (function(Requestor, _requestor) {

      /**
       * The Connection model module.
       * @module model/Connection
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>Connection</code>.
       * @alias module:model/Connection
       * @class
       */
      function Connection() {

      }

      /**
       * Constructs a <code>Connection</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/Connection } obj Optional instance to populate.
       * @return {module:model/Connection } The populated <code>Connection</code> instance.
       */
      Connection.create = function(data, obj) {
        if (data) {
          obj = obj || new Connection();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('service')) {
            obj['service'] = Requestor.convertToType(data['service'], 'String');
          }
          if (data.hasOwnProperty('settings')) {
            obj['settings'] = Requestor.convertToType(data['settings'], 'Object');
          }
          if (data.hasOwnProperty('ownerId')) {
            obj['ownerId'] = Requestor.convertToType(data['ownerId'], 'String');
          }
          if (data.hasOwnProperty('ownerType')) {
            obj['ownerType'] = Requestor.convertToType(data['ownerType'], 'String');
          }
          if (data.hasOwnProperty('createdAt')) {
            obj['createdAt'] = Requestor.convertToType(data['createdAt'], 'String');
          }
          if (data.hasOwnProperty('updatedAt')) {
            obj['updatedAt'] = Requestor.convertToType(data['updatedAt'], 'String');
          }
          if (data.hasOwnProperty('repoId')) {
            obj['repoId'] = Requestor.convertToType(data['repoId'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      Connection.prototype['id'] = undefined;
      /**
       * 
       * @member { String } name
       */
      Connection.prototype['name'] = undefined;
      /**
       * 
       * @member { String } service
       */
      Connection.prototype['service'] = undefined;
      /**
       * 
       * @member { Object } settings
       */
      Connection.prototype['settings'] = undefined;
      /**
       * 
       * @member { String } ownerId
       */
      Connection.prototype['ownerId'] = undefined;
      /**
       * 
       * @member { String } ownerType
       */
      Connection.prototype['ownerType'] = undefined;
      /**
       * 
       * @member { String } createdAt
       */
      Connection.prototype['createdAt'] = undefined;
      /**
       * 
       * @member { String } updatedAt
       */
      Connection.prototype['updatedAt'] = undefined;
      /**
       * 
       * @member { String } repoId
       */
      Connection.prototype['repoId'] = undefined;

      return Connection;
    })(Requestor, requestor);
    models['LayerResource'] = (function(Requestor, _requestor) {

      /**
       * The LayerResource model module.
       * @module model/LayerResource
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>LayerResource</code>.
       * @alias module:model/LayerResource
       * @class
       */
      function LayerResource() {

      }

      /**
       * Constructs a <code>LayerResource</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/LayerResource } obj Optional instance to populate.
       * @return {module:model/LayerResource } The populated <code>LayerResource</code> instance.
       */
      LayerResource.create = function(data, obj) {
        if (data) {
          obj = obj || new LayerResource();

          if (data.hasOwnProperty('id')) {
            obj['id'] = Requestor.convertToType(data['id'], 'String');
          }
          if (data.hasOwnProperty('connectionId')) {
            obj['connectionId'] = Requestor.convertToType(data['connectionId'], 'String');
          }
          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('label')) {
            obj['label'] = Requestor.convertToType(data['label'], 'String');
          }
          if (data.hasOwnProperty('columns')) {
            obj['columns'] = Requestor.convertToType(data['columns'], 'Array');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } id
       */
      LayerResource.prototype['id'] = undefined;
      /**
       * 
       * @member { String } connectionId
       */
      LayerResource.prototype['connectionId'] = undefined;
      /**
       * 
       * @member { String } name
       */
      LayerResource.prototype['name'] = undefined;
      /**
       * 
       * @member { String } label
       */
      LayerResource.prototype['label'] = undefined;
      /**
       * 
       * @member { Array } columns
       */
      LayerResource.prototype['columns'] = undefined;

      return LayerResource;
    })(Requestor, requestor);
    models['LayerResourceColumn'] = (function(Requestor, _requestor) {

      /**
       * The LayerResourceColumn model module.
       * @module model/LayerResourceColumn
       * @version 1.0.0
       */

      /**
       * Constructs a new <code>LayerResourceColumn</code>.
       * @alias module:model/LayerResourceColumn
       * @class
       */
      function LayerResourceColumn() {

      }

      /**
       * Constructs a <code>LayerResourceColumn</code> from a plain JavaScript object, optionally creating a new instance.
       * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
       * @param {Object} data The plain JavaScript object bearing properties of interest.
       * @param {module:model/LayerResourceColumn } obj Optional instance to populate.
       * @return {module:model/LayerResourceColumn } The populated <code>LayerResourceColumn</code> instance.
       */
      LayerResourceColumn.create = function(data, obj) {
        if (data) {
          obj = obj || new LayerResourceColumn();

          if (data.hasOwnProperty('name')) {
            obj['name'] = Requestor.convertToType(data['name'], 'String');
          }
          if (data.hasOwnProperty('type')) {
            obj['type'] = Requestor.convertToType(data['type'], 'String');
          }
        }
        return obj;
      };

      /**
       * 
       * @member { String } name
       */
      LayerResourceColumn.prototype['name'] = undefined;
      /**
       * 
       * @member { String } type
       */
      LayerResourceColumn.prototype['type'] = undefined;

      return LayerResourceColumn;
    })(Requestor, requestor);

    // Services definitions
    const Auth = (function(requestor) {
      /**
       * Auth service.
       * @module api/Auth
       * @version 1.0.0
       */

      /**
       * Auth service.
       * @alias module:api/Auth
       */
      var Auth = {};

      Auth.actions = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['model'] = opts['model'];
        queryParams['full'] = opts['full'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/auth/actions', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Auth;
    })(requestor);
    const Roles = (function(requestor) {
      /**
       * Roles service.
       * @module api/Roles
       * @version 1.0.0
       */

      /**
       * Roles service.
       * @alias module:api/Roles
       */
      var Roles = {};

      Roles.findUsers = function(roleIdOrName, scopeType, scopeId, cb) {
        // verify the required parameter 'roleIdOrName' is set
        if (roleIdOrName == undefined || roleIdOrName == null) {
          throw new Error("Missing the required parameter 'roleIdOrName' when calling findUsers");
        }
        // verify the required parameter 'scopeType' is set
        if (scopeType == undefined || scopeType == null) {
          throw new Error("Missing the required parameter 'scopeType' when calling findUsers");
        }
        // verify the required parameter 'scopeId' is set
        if (scopeId == undefined || scopeId == null) {
          throw new Error("Missing the required parameter 'scopeId' when calling findUsers");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['roleIdOrName'] = roleIdOrName;

        queryParams['scopeType'] = scopeType;
        queryParams['scopeId'] = scopeId;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/roles/users/{roleIdOrName}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Roles.findOrgTeamRoleUsers = function(orgId, role, cb) {
        // verify the required parameter 'orgId' is set
        if (orgId == undefined || orgId == null) {
          throw new Error("Missing the required parameter 'orgId' when calling findOrgTeamRoleUsers");
        }
        // verify the required parameter 'role' is set
        if (role == undefined || role == null) {
          throw new Error("Missing the required parameter 'role' when calling findOrgTeamRoleUsers");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['orgId'] = orgId;
        pathParams['role'] = role;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/roles/org/{orgId}/teams/role/{role}/users', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Roles;
    })(requestor);
    const Asset = (function(requestor) {
      /**
       * Asset service.
       * @module api/Asset
       * @version 1.0.0
       */

      /**
       * Asset service.
       * @alias module:api/Asset
       */
      var Asset = {};

      Asset.avatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/assets/avatar/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Asset;
    })(requestor);
    const Account = (function(requestor) {
      /**
       * Account service.
       * @module api/Account
       * @version 1.0.0
       */

      /**
       * Account service.
       * @alias module:api/Account
       */
      var Account = {};

      Account.prototype$__findById__accessTokens = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__findById__accessTokens");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__findById__accessTokens");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/accessTokens/{fk}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__destroyById__accessTokens = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__destroyById__accessTokens");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__destroyById__accessTokens");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/accessTokens/{fk}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__updateById__accessTokens = function(id, fk, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__updateById__accessTokens");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__updateById__accessTokens");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/accessTokens/{fk}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__findById__repos = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__findById__repos");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__findById__repos");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/repos/{fk}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__destroyById__repos = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__destroyById__repos");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__destroyById__repos");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/repos/{fk}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__updateById__repos = function(id, fk, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__updateById__repos");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__updateById__repos");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/repos/{fk}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__get__namespace = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__namespace");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/namespace', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__create__namespace = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__namespace");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/namespace', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__update__namespace = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__update__namespace");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/namespace', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__destroy__namespace = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__destroy__namespace");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/namespace', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__get__accessTokens = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__accessTokens");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/accessTokens', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__create__accessTokens = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__accessTokens");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/accessTokens', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__delete__accessTokens = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__delete__accessTokens");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/accessTokens', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__count__accessTokens = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__count__accessTokens");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/accessTokens/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__get__repos = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__repos");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/repos', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__create__repos = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__repos");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/repos', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$__count__repos = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__count__repos");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/repos/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.create = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.exists__get_accounts__id__exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists__get_accounts__id__exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.exists__head_accounts__id_ = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists__head_accounts__id_");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}', 'HEAD',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.replaceById__put_accounts__id_ = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling replaceById__put_accounts__id_");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.replaceById__post_accounts__id__replace = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling replaceById__post_accounts__id__replace");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/replace', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.login = function(credentials, opts, cb) {
        // verify the required parameter 'credentials' is set
        if (credentials == undefined || credentials == null) {
          throw new Error("Missing the required parameter 'credentials' when calling login");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['include'] = opts['include'];

        var postBody = null;
        postBody = credentials;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/login', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.logout = function(cb) {

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/logout', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.confirm = function(uid, token, opts, cb) {
        // verify the required parameter 'uid' is set
        if (uid == undefined || uid == null) {
          throw new Error("Missing the required parameter 'uid' when calling confirm");
        }
        // verify the required parameter 'token' is set
        if (token == undefined || token == null) {
          throw new Error("Missing the required parameter 'token' when calling confirm");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['uid'] = uid;
        queryParams['token'] = token;
        queryParams['redirect'] = opts['redirect'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/confirm', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.resetPassword = function(options, cb) {
        // verify the required parameter 'options' is set
        if (options == undefined || options == null) {
          throw new Error("Missing the required parameter 'options' when calling resetPassword");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = options;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/reset', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.changePassword = function(oldPassword, newPassword, cb) {
        // verify the required parameter 'oldPassword' is set
        if (oldPassword == undefined || oldPassword == null) {
          throw new Error("Missing the required parameter 'oldPassword' when calling changePassword");
        }
        // verify the required parameter 'newPassword' is set
        if (newPassword == undefined || newPassword == null) {
          throw new Error("Missing the required parameter 'newPassword' when calling changePassword");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        formParams['oldPassword'] = oldPassword;
        formParams['newPassword'] = newPassword;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/password', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.enable = function(identity, cb) {
        // verify the required parameter 'identity' is set
        if (identity == undefined || identity == null) {
          throw new Error("Missing the required parameter 'identity' when calling enable");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['identity'] = identity;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{identity}/enable', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.disable = function(identity, cb) {
        // verify the required parameter 'identity' is set
        if (identity == undefined || identity == null) {
          throw new Error("Missing the required parameter 'identity' when calling disable");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['identity'] = identity;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{identity}/disable', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.uploadAvatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/avatar', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.downloadAvatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/avatar', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Account.removeAvatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/accounts/{id}/avatar', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Account;
    })(requestor);
    const Org = (function(requestor) {
      /**
       * Org service.
       * @module api/Org
       * @version 1.0.0
       */

      /**
       * Org service.
       * @alias module:api/Org
       */
      var Org = {};

      Org.prototype$__get__namespace = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__namespace");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/namespace', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$__create__namespace = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__namespace");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/namespace', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$__update__namespace = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__update__namespace");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/namespace', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$__destroy__namespace = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__destroy__namespace");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/namespace', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$__get__teams = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__teams");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/teams', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$__create__teams = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__teams");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/teams', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$__count__teams = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__count__teams");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/teams/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$__get__repos = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__repos");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/repos', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$__create__repos = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__repos");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/repos', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$__count__repos = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__count__repos");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/repos/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.create = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.uploadAvatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/avatar', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.downloadAvatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/avatar', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.removeAvatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/avatar', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.findRoles = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findRoles");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/roles', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.checkMembershipForUser = function(id, username, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling checkMembershipForUser");
        }
        // verify the required parameter 'username' is set
        if (username == undefined || username == null) {
          throw new Error("Missing the required parameter 'username' when calling checkMembershipForUser");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['username'] = username;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/membership/{username}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.getMembershipsForUser = function(id, username, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling getMembershipsForUser");
        }
        // verify the required parameter 'username' is set
        if (username == undefined || username == null) {
          throw new Error("Missing the required parameter 'username' when calling getMembershipsForUser");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['username'] = username;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/memberships/{username}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.addMembership = function(id, username, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling addMembership");
        }
        // verify the required parameter 'username' is set
        if (username == undefined || username == null) {
          throw new Error("Missing the required parameter 'username' when calling addMembership");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['username'] = username;

        formParams['role'] = opts['role'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/memberships/{username}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.removeMembership = function(id, username, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling removeMembership");
        }
        // verify the required parameter 'username' is set
        if (username == undefined || username == null) {
          throw new Error("Missing the required parameter 'username' when calling removeMembership");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['username'] = username;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/memberships/{username}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.getMemberships = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling getMemberships");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/memberships', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Org.invitations = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling invitations");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/orgs/{id}/invitations', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Org;
    })(requestor);
    const Form = (function(requestor) {
      /**
       * Form service.
       * @module api/Form
       * @version 1.0.0
       */

      /**
       * Form service.
       * @alias module:api/Form
       */
      var Form = {};

      Form.prototype$__get__owner = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__owner");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms/{id}/owner', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.prototype$__get__repo = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__repo");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms/{id}/repo', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.create = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.exists__get_forms__id__exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists__get_forms__id__exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.exists__head_forms__id_ = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists__head_forms__id_");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms/{id}', 'HEAD',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms/{id}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Form.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/forms/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Form;
    })(requestor);
    const Team = (function(requestor) {
      /**
       * Team service.
       * @module api/Team
       * @version 1.0.0
       */

      /**
       * Team service.
       * @alias module:api/Team
       */
      var Team = {};

      Team.prototype$__get__org = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__org");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/org', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.enable = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling enable");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/enable', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.disable = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling disable");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/disable', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.uploadAvatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/avatar', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.downloadAvatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/avatar', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.removeAvatar = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = opts['id'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/avatar', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.findRoles = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findRoles");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/roles', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.checkMembershipForUser = function(id, username, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling checkMembershipForUser");
        }
        // verify the required parameter 'username' is set
        if (username == undefined || username == null) {
          throw new Error("Missing the required parameter 'username' when calling checkMembershipForUser");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['username'] = username;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/membership/{username}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.getMembershipsForUser = function(id, username, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling getMembershipsForUser");
        }
        // verify the required parameter 'username' is set
        if (username == undefined || username == null) {
          throw new Error("Missing the required parameter 'username' when calling getMembershipsForUser");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['username'] = username;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/memberships/{username}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.addMembership = function(id, username, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling addMembership");
        }
        // verify the required parameter 'username' is set
        if (username == undefined || username == null) {
          throw new Error("Missing the required parameter 'username' when calling addMembership");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['username'] = username;

        formParams['role'] = opts['role'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/memberships/{username}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.removeMembership = function(id, username, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling removeMembership");
        }
        // verify the required parameter 'username' is set
        if (username == undefined || username == null) {
          throw new Error("Missing the required parameter 'username' when calling removeMembership");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['username'] = username;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/memberships/{username}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.getMemberships = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling getMemberships");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/memberships', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Team.invitations = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling invitations");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/teams/{id}/invitations', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Team;
    })(requestor);
    const Page = (function(requestor) {
      /**
       * Page service.
       * @module api/Page
       * @version 1.0.0
       */

      /**
       * Page service.
       * @alias module:api/Page
       */
      var Page = {};

      Page.prototype$__get__owner = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__owner");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages/{id}/owner', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.prototype$__get__repo = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__repo");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages/{id}/repo', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.create = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages/{id}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Page.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/pages/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Page;
    })(requestor);
    const Report = (function(requestor) {
      /**
       * Report service.
       * @module api/Report
       * @version 1.0.0
       */

      /**
       * Report service.
       * @alias module:api/Report
       */
      var Report = {};

      Report.prototype$__get__owner = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__owner");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/{id}/owner', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.prototype$__get__repo = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__repo");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/{id}/repo', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.create = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/{id}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.publish = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling publish");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/{id}/publish', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.withdraw = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling withdraw");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/{id}/withdraw', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Report.query = function(query, opts, cb) {
        // verify the required parameter 'query' is set
        if (query == undefined || query == null) {
          throw new Error("Missing the required parameter 'query' when calling query");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['opts'] = opts['opts'];

        var postBody = null;
        postBody = query;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/reports/query', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Report;
    })(requestor);
    const Layer = (function(requestor) {
      /**
       * Layer service.
       * @module api/Layer
       * @version 1.0.0
       */

      /**
       * Layer service.
       * @alias module:api/Layer
       */
      var Layer = {};

      Layer.prototype$__get__owner = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__owner");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/{id}/owner', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.prototype$__get__repo = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__repo");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/{id}/repo', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.create = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/{id}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.patchFields = function(id, fields, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling patchFields");
        }
        // verify the required parameter 'fields' is set
        if (fields == undefined || fields == null) {
          throw new Error("Missing the required parameter 'fields' when calling patchFields");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = fields;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/{id}/fields', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Layer.patchSchema = function(id, schema, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling patchSchema");
        }
        // verify the required parameter 'schema' is set
        if (schema == undefined || schema == null) {
          throw new Error("Missing the required parameter 'schema' when calling patchSchema");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = schema;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/layers/{id}/schema', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Layer;
    })(requestor);
    const Connection = (function(requestor) {
      /**
       * Connection service.
       * @module api/Connection
       * @version 1.0.0
       */

      /**
       * Connection service.
       * @alias module:api/Connection
       */
      var Connection = {};

      Connection.prototype$__get__owner = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__owner");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/{id}/owner', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.prototype$__get__repo = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__repo");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/{id}/repo', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.create = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/{id}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.replaceById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling replaceById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/{id}/replace', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.discoverResources = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling discoverResources");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/{id}/resources', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Connection.discoverSchemas = function(id, name, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling discoverSchemas");
        }
        // verify the required parameter 'name' is set
        if (name == undefined || name == null) {
          throw new Error("Missing the required parameter 'name' when calling discoverSchemas");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['name'] = name;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/connections/{id}/resources/{name}/schemas', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Connection;
    })(requestor);
    const Me = (function(requestor) {
      /**
       * Me service.
       * @module api/Me
       * @version 1.0.0
       */

      /**
       * Me service.
       * @alias module:api/Me
       */
      var Me = {};

      Me.currentUser = function(cb) {

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/me', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Me.tokens = function(cb) {

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/me/tokens', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Me.findOrgsMemberships = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['state'] = opts['state'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/me/memberships/orgs', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Me.findOrgMembership = function(org, cb) {
        // verify the required parameter 'org' is set
        if (org == undefined || org == null) {
          throw new Error("Missing the required parameter 'org' when calling findOrgMembership");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['org'] = org;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/me/memberships/org/{org}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Me.updateOrgMembership = function(org, opts, cb) {
        // verify the required parameter 'org' is set
        if (org == undefined || org == null) {
          throw new Error("Missing the required parameter 'org' when calling updateOrgMembership");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['org'] = org;

        formParams['state'] = opts['state'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/me/memberships/org/{org}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Me.findTeams = function(cb) {

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/me/teams', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Me.findRepos = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/me/repos', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Me.createRepos = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        formParams['data'] = opts['data'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/me/repos', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Me;
    })(requestor);
    const Repo = (function(requestor) {
      /**
       * Repo service.
       * @module api/Repo
       * @version 1.0.0
       */

      /**
       * Repo service.
       * @alias module:api/Repo
       */
      var Repo = {};

      Repo.prototype$__get__owner = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__owner");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/owner', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__findById__connections = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__findById__connections");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__findById__connections");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/connections/{fk}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__destroyById__connections = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__destroyById__connections");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__destroyById__connections");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/connections/{fk}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__updateById__connections = function(id, fk, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__updateById__connections");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__updateById__connections");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/connections/{fk}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__findById__layers = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__findById__layers");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__findById__layers");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/layers/{fk}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__destroyById__layers = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__destroyById__layers");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__destroyById__layers");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/layers/{fk}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__updateById__layers = function(id, fk, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__updateById__layers");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__updateById__layers");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/layers/{fk}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__findById__forms = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__findById__forms");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__findById__forms");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/forms/{fk}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__destroyById__forms = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__destroyById__forms");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__destroyById__forms");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/forms/{fk}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__updateById__forms = function(id, fk, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__updateById__forms");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__updateById__forms");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/forms/{fk}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__findById__reports = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__findById__reports");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__findById__reports");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/reports/{fk}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__destroyById__reports = function(id, fk, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__destroyById__reports");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__destroyById__reports");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/reports/{fk}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__updateById__reports = function(id, fk, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__updateById__reports");
        }
        // verify the required parameter 'fk' is set
        if (fk == undefined || fk == null) {
          throw new Error("Missing the required parameter 'fk' when calling prototype$__updateById__reports");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;
        pathParams['fk'] = fk;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/reports/{fk}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__get__connections = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__connections");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/connections', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__create__connections = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__connections");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/connections', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__delete__connections = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__delete__connections");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/connections', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__count__connections = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__count__connections");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/connections/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__get__layers = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__layers");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/layers', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__create__layers = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__layers");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/layers', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__delete__layers = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__delete__layers");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/layers', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__count__layers = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__count__layers");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/layers/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__get__forms = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__forms");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/forms', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__create__forms = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__forms");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/forms', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__delete__forms = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__delete__forms");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/forms', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__count__forms = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__count__forms");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/forms/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__get__reports = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__reports");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/reports', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__create__reports = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__create__reports");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/reports', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__delete__reports = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__delete__reports");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/reports', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$__count__reports = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__count__reports");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/reports/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.exists__get_repos__id__exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists__get_repos__id__exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.exists__head_repos__id_ = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists__head_repos__id_");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}', 'HEAD',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.replaceById__put_repos__id_ = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling replaceById__put_repos__id_");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}', 'PUT',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.replaceById__post_repos__id__replace = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling replaceById__post_repos__id__replace");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{id}/replace', 'POST',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.get = function(owner, repo, cb) {
        // verify the required parameter 'owner' is set
        if (owner == undefined || owner == null) {
          throw new Error("Missing the required parameter 'owner' when calling get");
        }
        // verify the required parameter 'repo' is set
        if (repo == undefined || repo == null) {
          throw new Error("Missing the required parameter 'repo' when calling get");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['owner'] = owner;
        pathParams['repo'] = repo;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{owner}/{repo}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.edit = function(owner, repo, data, cb) {
        // verify the required parameter 'owner' is set
        if (owner == undefined || owner == null) {
          throw new Error("Missing the required parameter 'owner' when calling edit");
        }
        // verify the required parameter 'repo' is set
        if (repo == undefined || repo == null) {
          throw new Error("Missing the required parameter 'repo' when calling edit");
        }
        // verify the required parameter 'data' is set
        if (data == undefined || data == null) {
          throw new Error("Missing the required parameter 'data' when calling edit");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['owner'] = owner;
        pathParams['repo'] = repo;

        formParams['data'] = data;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{owner}/{repo}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Repo.delete = function(owner, repo, cb) {
        // verify the required parameter 'owner' is set
        if (owner == undefined || owner == null) {
          throw new Error("Missing the required parameter 'owner' when calling delete");
        }
        // verify the required parameter 'repo' is set
        if (repo == undefined || repo == null) {
          throw new Error("Missing the required parameter 'repo' when calling delete");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['owner'] = owner;
        pathParams['repo'] = repo;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/repos/{owner}/{repo}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Repo;
    })(requestor);
    const Namespace = (function(requestor) {
      /**
       * Namespace service.
       * @module api/Namespace
       * @version 1.0.0
       */

      /**
       * Namespace service.
       * @alias module:api/Namespace
       */
      var Namespace = {};

      Namespace.prototype$__get__owner = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$__get__owner");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['refresh'] = opts['refresh'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces/{id}/owner', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Namespace.patchOrCreate = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Namespace.find = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Namespace.exists__get_Namespaces__id__exists = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists__get_Namespaces__id__exists");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces/{id}/exists', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Namespace.exists__head_Namespaces__id_ = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling exists__head_Namespaces__id_");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces/{id}', 'HEAD',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Namespace.findById = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling findById");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces/{id}', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Namespace.deleteById = function(id, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling deleteById");
        }

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces/{id}', 'DELETE',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Namespace.prototype$patchAttributes = function(id, opts, cb) {
        // verify the required parameter 'id' is set
        if (id == undefined || id == null) {
          throw new Error("Missing the required parameter 'id' when calling prototype$patchAttributes");
        }
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        pathParams['id'] = id;

        var postBody = null;
        postBody = opts['data'];

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces/{id}', 'PATCH',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Namespace.findOne = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['filter'] = opts['filter'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces/findOne', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };
      Namespace.count = function(opts, cb) {
        if (typeof opts === 'function') {
          cb = opts;
          opts = null;
        }
        opts = opts || {};

        var pathParams = {};
        var queryParams = {};
        var headerParams = {};
        var formParams = {};

        queryParams['where'] = opts['where'];

        var postBody = null;

        var authNames = [];
        var contentTypes = ['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml'];
        var accepts = ['application/json'];
        var returnType = Object;

        return requestor.request(
          '/Namespaces/count', 'GET',
          pathParams, queryParams, headerParams, formParams, postBody,
          authNames, contentTypes, accepts, returnType, cb
        );
      };

      return Namespace;
    })(requestor);

    // Export models
    that.models = models;

    // Export services
    that.Auth = Auth;
    that.Roles = Roles;
    that.Asset = Asset;
    that.Account = Account;
    that.Org = Org;
    that.Form = Form;
    that.Team = Team;
    that.Page = Page;
    that.Report = Report;
    that.Layer = Layer;
    that.Connection = Connection;
    that.Me = Me;
    that.Repo = Repo;
    that.Namespace = Namespace;
  }

  return new Client();
}));