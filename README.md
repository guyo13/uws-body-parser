# uws-body-parser

uws-body-parser is a request body parsing middleware for uWebSockets.js.

## Typical usage

```js
const { App } = require('uWebSockets.js');

const app = App();

app.post('/my/api/endpoint', (res, req) => {
  bodyParser(res, req, (data, wasParsed) => {
      // `wasParsed` argument is a boolean indicating if the body was actually parsed
      if (!wasParsed) {
        console.log('Body not parsed!');
      }
      // `data` argument is the parsed JSON/xWwwFormUrlEncoded/Raw Buffer body
      console.log(data);
      // TODO: your logic here
    }, () => { console.error('request aborted'); }
  );
});
```
