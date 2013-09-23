# Quester

Let's go on a (re)quest.

## What is Quester?

Quester is a smallish wrapper around [Request](https://github.com/mikeal/request)
that makes it easy to make batch requests and handle the response as one unit.

It also has support for depdendencies between requests. So POST data or
parameters from a request can be used as data to another request. This is done
using [JSONPath](https://github.com/s3u/JSONPath).

## Installation

Install using [npm](http:/npmjs.org) per usual.

`npm install quester --save`

## Example Usage

The _Quester_ API is pretty simple. This is how you make a GET request.

```javascript
var quester = require('quester');
var client  = new quester('http://base.url.for.api.com/api');

client.get('/thing')
  .execute(function (err, result, requests) {
    if (err) throw err;

    // Result is an array of all the performed requests in the current batch
    // In this case a single JSON object.
    var thing = result[0];

    // Requests is an array of the performed requests. Index of result and
    // requuests match up.
    console.log('Finished fetching:', requests[0].uri);
  });
```

### Making batch requests

_Quester_ makes it easy to make a bunch of requests at once and process them
in one callback.

_Please don't mind the terrible HTTP API "design" below._

```javascript
var quester = require('quester');
var client  = new quester('http://base.com');

// Queue a get request with additional querystring parameters
client.get('/thing', { sort: 'asc' });

// Queue a post request
client.post('/blog', { title: 'Post title', body: 'lorem ipsum' });

// Suppose '/blog' returns an object with the newly created posts id
// and you have an API to get comments for a blogpost.
// Setting a parameter to an object with the key "jsonpath" let's you
// Add data from a previous request.
client.get('/blog/comments', { forPost: { jsonpath: '$.id' } });
```

## API

