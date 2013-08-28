//
// # Quester
//
// Helper module to batch up requests and stuff.
//

var req = require('./lib/request');

//
// ## Create new Client
//
// * **base**, base URL of the API.
//
var Quester = module.exports = function Quester(base) {
  this.base      = base;
  this.modifiers = [];
};

//
// ## Add modifier function
//
// Ads a function that will be called once for each request being made. The
// request itself will be the first argument, a callback the second. If the
// callback is passed an error the request batch will be aborted.
//
// * **fn**, the function or array of functions.
//
// **Returns** nothin.
//
Quester.prototype.addModifier = function addModifier (fn) {
  if (Array.isArray(fn)) {
    var self = this;
    fn.map(function (func) {
      self.addModifier(func);
    });
  }
  else {
    this.modifiers.push(fn);
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

