//
// # Test Quester
//

var assert  = require('assert');
var Quester = require('./../index');

var base = 'http://127.0.0.1';

suite('Quester', function () {

  //
  // ## Test creating a client
  //
  test('Creating a client works', function () {
    var q = new Quester(base);
    assert(q);
  });

  //
  // ## Test adding modifiers
  //
  test('Adding modifier functions work', function () {
    function test(a) {
      return a;
    }

    var q = new Quester(base);
    q.addModifier('test', test);
    assert.equal('a', q.modifiers.test('a'));
  });

  //
  // ## Test adding array of modifiers
  //
  test('Adding array of modifiers work', function () {
    var fns = [
      { name: 'a', fn: function (a) { return a; } },
      { name: 'b', fn: function (x) { return x * 2; } }
    ];
    var q = new Quester(base);
    q.addModifier(fns);

    assert.equal('a', q.modifiers.a('a'));
    assert.equal(4, q.modifiers.b(2));
  });

  //
  // ## Test creating new request
  //
  test('Creating new request works', function () {
    var q = new Quester(base);
    var r = q.request();
    assert.equal(typeof r, 'object');
    // Has correct reference to client.
    assert.equal(r.client.base, q.base);
  });

  //
  // ## Test http method shorthands
  //
  test('Shorthand functions work', function () {
    var q = new Quester(base);
    Quester.methods.map(function (method) {
      assert.equal(typeof q[method], 'function');
      var r = q[method]('/' + method);
      // Make sure last added object gets path
      assert.equal(r.tail().path, base + '/' + method);
      assert.equal(r.tail().method, method.toUpperCase());
    });
  });
});

