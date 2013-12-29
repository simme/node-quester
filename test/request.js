//
// # Test Requests
//

var assert  = require('assert');
var http    = require('http');
var Quester = require('./../index');
var _       = require('lodash');

var port = 7357;
var base = 'http://127.0.0.1:' + port;
var serv = null;
var client = new Quester(base);

suite('Requests', function () {

  //
  // ## Start Server
  //
  // Starts up a server that echoes back the request.
  //
  setup(function (done) {
    serv = http.createServer(function (req, res) {
      var body = '';
      req.on('data', function (chunk) { body += chunk; });
      req.on('error', function (err) { console.log(err); });
      req.on('end', function () {
        var parts = [
          req.url,
          req.method,
          body
        ];
        if (req.url === '/time') {
          setTimeout(function () {
            res.end(JSON.stringify(parts));
          }, 2000);
        }
        else {
          res.end(JSON.stringify(parts));
        }
      });
    });
    serv.listen(port, done);
    serv.on('error', function (err) {
      console.log('\n-- TEST SERVER ERROR--\n', err);
    });
  });

  //
  // ## Stop Server
  //
  // Stops the server.
  //
  teardown(function () {
    serv.close();
  });

  //
  // ## Test making batch request
  //
  test('Making batch request works', function (done)   {
    var exp = [
      '/a/GET/',
      '/b/GET/',
      '/c/POST/',
      '/d/PUT/',
      '/e?beep=boop/DELETE/'
    ];
    client.get('/a')
      .get('/b')
      .post('/c')
      .put('/d')
      .delete('/e', { beep: 'boop' })
      .execute(expected(exp, done));
  });

  //
  // ## Post request correctly post data
  //
  // Make sure post requests actually send their data.
  //
  test('Post requests work', function (done) {
    var exp = [ '/a?foo=bar/POST/{"b":"c"}'];
    client.post('/a', { b: 'c' }, { foo: 'bar' })
      .execute(expected(exp, done));
  });

  //
  // ## Put requests correctly puts data
  //
  test('Put requests work', function (done) {
    var exp = [ '/a?foo=bar/PUT/{"b":"c"}'];
    client.put('/a', { b: 'c' }, { foo: 'bar' })
      .execute(expected(exp, done));
  });

  //
  // ## Dependency driven requests
  //
  test('Dependency checking and replacing works', function (done) {
    // Make get request and use response to make post request.
    client.get('/dependency', { bar: 'foo' })
      .get('/test')
      .post('/foo', { dep: { jsonpath: '0::$.0' } } )
      .execute(function (err, response, requests) {
        assert.equal(response[2].body[2], '{"dep":"/dependency?bar=foo"}');
        done();
      });
  });

  //
  // ## Test adding dependency to non-existent request
  //
  test('Adding dependency on non-existent request failes', function () {
    try {
      client.get('/foo', { foo: { jsonpath: 'bar' } }).execute();
      assert(!true);
    } catch (err) { }
  });

  //
  // ## Connnection pooling is circumvented
  //
  test('Connection pooling is circumvented', function (done) {
    // 10 requests each taking 2 seconds, should not take more then 3 seconds
    // 1 extra second to account for processing etc.
    this.timeout(3 * 1000);
    client
      .get('/time')
      .get('/time')
      .get('/time')
      .get('/time')
      .get('/time')
      .get('/time')
      .get('/time')
      .get('/time')
      .get('/time')
      .get('/time')
      .execute(function (err, response, requests) {
        done();
      });
  });

});

//
// ## Callback Helper
//
// Creates a new function that can be used as a callback to `execute`. It takes
// an array of expected values. Once the callback is called the expected values
// are compared to the values given by `execute`.
//
// * **expected**
// * **done**, function to call on completion.
//
function expected(exp, done) {
  return function (err, response) {
    assert(!err, err);

    if (Array.isArray(response)) {
      response = response.map(function (resp) {
        if (typeof resp.body === 'string') return JSON.parse(resp.body);
        else return resp.body;
      });
    }
    else {
      response = [response.body];
    }

    assert.equal(exp.length, response.length, 'Not correct amount of responses.');
    for (var i in exp) {
      assert.equal(exp[i], response[i].join('/'), 'Non matching request.');
    }
    done();
  };
}

