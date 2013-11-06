//
// # Request
//
// The interface for doing a request.
//
/* jslint evil: true */

var _        = require('lodash');
var async    = require('async');
var jsonpath = require('JSONPath').eval;
var request  = require('request');

//
// ## Create new request
//
var Request = module.exports = function (client) {
  this.client   = client;
  this.requests = [];
  this.hasDeps  = false;
};

//
// ## Tail
//
// Get the last request on the stack.
//
// **Returns** an object representing the top request.
//
Request.prototype.tail = function tail() {
  var ret = null;
  if (this.requests.length > 0) {
    ret = this.requests[this.requests.length - 1];
  }

  return ret;
};

//
// ## Make a get request
//
// Adds a get request to the list of requests to make.
//
// * **path**, the path to fetch.
// * **params**, object of querystring parameters.
//
// **Returns** the request, to allow chaining.
//
Request.prototype.get = function get(path, params) {
  return this.addRequest('GET', path, null, params);
};

//
// ## Make a post request
//
// Adds a post request to the list of requests to make.
//
// * **path**, the path to post to.
// * **data**, data to post. Data may also be added later using the `.data()`
//   method.
// * **params**, object of querystring parameters.
//
// **Returns** the request, to allow chaining.
//
Request.prototype.post = function post(path, data, params) {
  return this.addRequest('POST', path, data, params);
};

//
// ## Make a put request
//
// Adds a put request to the list of requests to make.
//
// * **path**, the path to post to.
// * **data**, data to put. Data may also be added later using the `.data()`
//   method.
// * **params**, object of querystring parameters.
//
// **Returns** the request, to allow chaining.
//
Request.prototype.put = function put(path, data, params) {
  return this.addRequest('PUT', path, data, params);
};

//
// ## Make a delete request
//
// Adds a delete request to the list of requests to make.
//
// * **path**, the path to post to.
// * **params**, object of querystring parameters.
//
// **Returns** the request, to allow chaining.
//
Request.prototype.delete = function del(path, params) {
  return this.addRequest('DELETE', path, null, params);
};

//
// ## Add data
//
// Adds data to the last added request. Does nothing if added to a GET request.
// Data is merged with existing unless the `replace` argument is true.
//
// * **data**, the data to add.
// * **replace**, if `true` existing data will be replaced.
//
// **Returns** the request, to allow chaining.
//
Request.prototype.addData = function addData(data, replace) {
  var req = this.tail();
  if (replace) {
    req.data = data;
  }
  else {
    req.data = _.merge(req.data, data);
  }

  return this;
};

//
// ## Add parameters
//
// Adds paramaters to the last added request. Will be used in the querystring.
// Parameters are merged with existing unless the `replace` argument is true.
//
// * **params**, the parameters to add.
// * **replace**, if `true` existin parameters will be replaced.
//
// **Returns** the request, to allow chaining.
//
Request.prototype.addParameters = function addParameters(params, replace) {
  var req = this.tail();
  if (replace) {
    req.params = params;
  }
  else {
    req.params = _.merge(req.params, params);
  }

  return this;
};

//
// ## Add headers
//
// Add headers to a request.
//
// * **headers**, the headers to add.
// * **replace**, if `true` existin headers will be replaced.
//
// **Returns** the request, to allow chaining.
//
Request.prototype.addHeaders = function addHeaders(headers, replace) {
  var req = this.tail();
  if (replace) {
    req.headers = headers;
  }
  else {
    req.headers = _.merge(req.headers, headers);
  }

  return this;
};

//
// ## Add post-modifier
//
// Adds a function to be run after the current request has completed. The
// function will only be run on success and before the end callback is
// invoked. The function is executed within the context of the request. So
// you can to `this.params` to get the request parameters. The arguments to the
// modifier will be `body` and `response`.
//
// A request can have multiple post modifiers.
//
// * **modifier**, `function (body)`
//
// **Returns** the request, to allow chaining.
//
Request.prototype.addPostModifier = function addPostModifier(modifier) {
  this.tail().postModifiers.push(modifier);
};

//
// ## Add request to batch
//
// Adds a request of the given method for the given path to the batch.
//
// * **method**, HTTP method.
// * **path**, the path.
// * **data**, request data.
// * **params**, request parameters (querystring).
//
// **Returns** the request, to allow chaining.
//
Request.prototype.addRequest = function addRequest(method, path, data, params) {
  var base = this.client.base;
  this.requests.push({
    method: method,
    path: [base, path].join(''),
    data: data || {},
    params: params || {},
    headers: {},
    postModifiers: []
  });

  return this;
};

//
// ## Execute
//
// Executes the requests in the batch. The callback will be called if one
// request failes (or a request modifier causes an error) or when all the
// requests have completed.
//
// * **fn**, the callback function. First argument is any error, second is
//   an array of responses, third is the requests that were made.
//
// **Returns** nothing.
//
Request.prototype.execute = function execute(fn) {
  var self = this;
  this._determineDependencies();

  // Function that makes the actual request.
  function makeRequest(req) {
    Object.keys(self.client.modifiers).map(function applyModifier(name) {
      self.client.modifiers[name](req);
    });

    return function (callback, results) {
      if (req.dependencies.length > 1) {
        self.insertDependencies(req, results);
      }

      var opts = {
        uri:     req.path,
        method:  req.method,
        headers: req.headers,
        // Override default of 2 minutes for timeout.
        timeout: 30 * 1000,
        // Opt out of the default global agent pooling.
        pool:    false
      };

      if (Object.keys(req.params).length > 0) {
        opts.qs = req.params;
      }

      if (Object.keys(req.data).length > 0) {
        opts[self.client.format] = req.data;
      }

      var _req = request(opts, function (err, res, body) {
        if (err) {
          callback(err, body, res);
          return;
        }

        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          }
          catch (er) {
            callback(er, body, res);
            return;
          }
        }

        // Apply post modifiers
        if (req.postModifiers.length > 0) {
          var funcs = req.postModifiers.map(function(fn) {
            return _.partial(fn, body, res).bind(req);
          });
          async.waterfall(funcs, function (err, result) {
            callback(err, {
              body: result,
              response: res
            });
          });
        }
        else {
          callback(null, {
            body: body,
            response: res
          });
        }
      });
      // @TODO: listen to error-events on _req
      _req.on('error', function (err) {
        console.log('\n--- ERROR ---\n');
        console.log(err, opts.uri);
      });
    };
  }

  // Setup structure to pass to async.
  var batch = {};
  this.requests.map(function (req, index) {
    if (self.hasDeps) {
      req.dependencies.push(makeRequest(req));
      batch[index + ''] = req.dependencies;
    }
    else {
      batch[index + ''] = makeRequest(req);
    }
  });

  // Execute requests.
  var method = this.hasDeps ? 'auto' : 'parallel';
  async[method](batch, function (err, result) {
    var response = [];
    _.forEach(result, function (itm) { response.push (itm); });
    if (response.length === 1) {
      response = response[0];
    }
    fn(err, response, self.requests);
  });
};

//
// ## Determine dependencies
//
// Looks through the request data and parameters to see if any of the values
// has a dependency on an other request.
//
// A request has a dependency if a data or parameter value is an object
// with the single key `jsonpath` with a string value.
//
// The jsonpath string can be prefixed with `index::` where index is the
// numerical index of an already added request. If no such prefix is found the
// dependency is added on the previously added request.
//
// **Returns** nothing. Modifies `this.requests` directly.
//
Request.prototype._determineDependencies = function _dd() {
  var prefix   = /^(\d+)::/;
  var previous = false;

  // Used to map params and data structures.
  function findDependency(dependencies) {
    return function (value, key) {
      if (typeof value === 'object' && typeof value.jsonpath === 'string') {
        var path = value.jsonpath;
        var dep  = path.match(prefix);
        if (dep) {
          dependencies.push(dep[1]);
        }
        else {
          if (previous !== false) {
            value.jsonpath = previous + '::' + path;
            dependencies.push(previous);
          }
          else {
            throw new Error('Can not add dependency to non-existent request.');
          }
        }
      }
    };
  }

  var self = this;
  this.requests.map(function (req, index) {
    req.dependencies = [];
    _.map(req.params, findDependency(req.dependencies));
    _.map(req.data, findDependency(req.dependencies));
    if (req.dependencies.length > 0) {
      self.hasDeps = true;
    }

    previous = index + '';
  });

};

//
// ## Insert Dependencies
//
// Takes a result object and a request and looks through the request to
// insert dependencies from previous requests.
//
// * **req**, the request about to be made.
// * **result**, the results from previous requests.
//
// **Returns** nothing.
//
Request.prototype.insertDependencies = function insertDep(req, result) {
  function insert(result) {
    return function (value, key, original) {
      var parts  = value.jsonpath.match(/^(\d+)?:?:?(.*)$/);
      var source = parts[1] || 0;
      var path   = parts[2] || false;

      if (!path) {
        throw new Error('Missing JSONPath in dependency.');
      }
      else {
        var val = jsonpath(result[source].body, path);
        original[key] = val.length === 1 ? val[0] : val;
      }
    };
  }

  _.map(req.data, insert(result));
  _.map(req.params, insert(result));
};

