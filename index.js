'use strict';

// Copyright (c) 2021, Guy Or Please see the AUTHORS file for details.
//  All rights reserved. Use of this source code is governed by a MIT
//  license that can be found in the LICENSE file.

const { StringDecoder } = require('string_decoder');

const utf8Decoder = new StringDecoder('utf8');

/// A mapping between supported body mime type and their parser
const mimeTypeParsers = Object.freeze({
  'application/x-www-form-urlencoded': xWwwFormUrlEncodedParser,
  'application/json': jsonParser
});

/// Parses a uWebSockets HTTP Request body
/// [res]     - uWebSockets HTTPResponse
/// [req]     - uWebSockets HTTPRequest
/// [cb]      - A callback that takes a two arguments :
/// [err]     - An error handler callback for onAborted event
///             the parsed body (string/Object) and a boolean
///             indicating if the body was parsed.
/// [options] - An object containing the `asJson` property, indicating
///             if application/x-www-form-urlencoded bodies
///             should be converted to JSON key-value pairs
function bodyParser(res, req, cb, err=()=>{}, options={ asJson: true }) {
  // Register error callback - res.close also calls onAborted
  res.onAborted(() => {
    res.aborted = true;
    err();
  });
  const contentType = req.getHeader('content-type');
  const parser = mimeTypeParsers[contentType] || rawParser;
  parser(res, cb, options);
};

/// Helper function for reading a request body.
/// [res]     - uWebSockets HTTPResponse
/// [cb]      - A callback that takes as an argument a Buffer object.
/// Must register an onAborted handler prior using it!
function readPostData(res, cb, options={}) {
  let buffer;
  // Register data cb
  res.onData((ab, isLast) => {
    let chunk = Buffer.from(ab);
    if (buffer) {
      buffer = Buffer.concat([buffer, chunk]);
    } else {
      buffer = Buffer.concat([chunk]);
    }
    if (isLast) {
      cb(buffer);
    }
  });
}

/// A Body Parser that reads the body and returns it as is (as Buffer)
/// [res]     - uWebSockets HTTPResponse
/// [cb]      - A callback that takes as an argument a Buffer object.
/// Must register an onAborted handler prior using it!
function rawParser(res, cb, options={}) {
  readPostData(res, (data) => { cb(data, false); }, options);
}

/// A parser for JSON request body
/// [res]     - uWebSockets HTTPResponse
/// [cb]      - See [bodyParser]
/// Must register an onAborted handler prior using it!
/// Originally written by the uWebSocket.js authors and improved by the library author
function jsonParser(res, cb, options={}) {
  let buffer;
  /* Register data cb */
  res.onData((ab, isLast) => {
    let chunk = Buffer.from(ab);
    if (isLast) {
      let json;
      if (buffer) {
        try {
          json = JSON.parse(Buffer.concat([buffer, chunk]));
        } catch (e) {
          console.error(e);
          res.close();
          return;
        }
        cb(json, true);
      } else {
        try {
          json = JSON.parse(chunk);
        } catch (e) {
          console.error(e);
          res.close();
          return;
        }
        cb(json, true);
      }
    } else {
      if (buffer) {
        buffer = Buffer.concat([buffer, chunk]);
      } else {
        buffer = Buffer.concat([chunk]);
      }
    }
  });
}

/// A parser for x-www-form-url-encoded request body
/// [res]     - uWebSockets HTTPResponse
/// [cb]      - See [bodyParser]
/// [options] - See [bodyParser]
/// Must register an onAborted handler prior using it!
function xWwwFormUrlEncodedParser(res, cb, options={ asJson: true }) {
  readPostData(res, (data) => {
    try {
      const str = utf8Decoder.write(data);
      const sequences = str.split('&');
      let output = [];
      let transBuf = Buffer.alloc(1);
      for (const seq of sequences) {
        if (seq.length > 0) {
          const pair = seq.split('=');
          const name = percentDecode(pair[0].replace(/\+/g, ' '), transBuf);
          const value = percentDecode(pair.slice(1).join('=').replace(/\+/g, ' '), transBuf);
          output.push([name, value]);
        }
      }
      if ( options.asJson) {
        const json = {};
        for (const tuple of output ) {
          const key = tuple[0];
          const val = tuple[1];
          // FIXME: This will override duplicates, add an option paramter to handle this behaviour
          json[key] = val;
        }
        output = json;
      }
      cb(output, true)
    } catch (e) {
      console.error(e);
      res.close();
      return;
    }
  }, options);
}

/// Helper function that preforms percent decoding [https://url.spec.whatwg.org/#percent-decode]
function percentDecode(str, buf=Buffer.alloc(1), decoder=utf8Decoder) {
  if (buf.length > 1) {
    throw('InvalidValue - buf length must be 1');
  }
  const output = [];
  for (let i=0; i < str.length; i++) {
    const chr = str[i];
    if ( chr != '%') {
      output.push(chr);
    } else {
      const chr1 = str[i+1];
      const chr2 = str[i+2];
      const range = '0123456789abcdefABCDEF';
      if (range.indexOf(chr1) < 0 && range.indexOf(chr2) < 0) {
        output.push(chr);
      } else {
        if (i >= str.length - 2) {
          throw('InvalidSequenceException - position overflow');
        }
        const intVal = Number.parseInt(str.slice(i+1, i+3), 16);
        buf[0] = intVal;
        output.push(decoder.write(buf));
        i += 2;
      }
    }
  }
  return output.join('');
}

/// Exports
module.exports.bodyParser = bodyParser;;
module.exports.rawParser = rawParser;
module.exports.jsonParser = jsonParser;
module.exports.xWwwFormUrlEncodedParser = xWwwFormUrlEncodedParser;
module.exports.percentDecode = percentDecode;
module.exports.supportedContentTypes = function() {
  return mimeTypeParsers;
};
