//
// # Quester
//
// Helper module to batch up requests and stuff.
//
// @TODO:
// - [ ] Test format option.
//

var req = require('./lib/request');

//
// ## Create new Client
//
// * **base**, base URL of the API.
// * **options**, options object.
//   * format: json (default) or form (form encoded). The way post data is sent.
//
var Quester = module.exports = function Quester(base, options) {
  options = options || {};
  this.base      = base;
  this.modifiers = {};
  this.format    = options.format || 'json';
};

//
// ## Add modifier function
//
// Ads a function that will be called once for each request being made. The
// request itself will be the first argument, a callback the second. If the
// callback is passed an error the request batch will be aborted.
//
// * **name**, the name of the modifier.
// * **fn**, the function or array of functions.
//
// **Returns** nothing.
//
Quester.prototype.addModifier = function addModifier(name, fn) {
  if (Array.isArray(name)) {
    var self = this;
    name.map(function (modifier) {
      self.addModifier(modifier.name, modifier.fn);
    });
  }
  else {
    this.modifiers[name] = fn;
  }
};

//
// ## Initiate a new request
//
// **Returns** a new request object with a reference to the current client.
//
Quester.prototype.request = function () {
  return new req(this);
};

//
// ## Convinience methods for creating a new request.
//
Quester.methods = ['get', 'post', 'put', 'delete'];
Quester.methods.map(function (method) {
  Quester.prototype[method] = function () {
    var r = new req(this);
    return r[method].apply(r, arguments);
  };
});

