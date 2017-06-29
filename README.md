# Bluefox
[![Build Status](https://travis-ci.org/Joris-van-der-Wel/bluefox.svg?branch=master)](https://travis-ci.org/Joris-van-der-Wel/bluefox) [![Coverage Status](https://coveralls.io/repos/github/Joris-van-der-Wel/bluefox/badge.svg?branch=master)](https://coveralls.io/github/Joris-van-der-Wel/bluefox?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/Joris-van-der-Wel/bluefox.svg)](https://greenkeeper.io/) [![Known Vulnerabilities](https://snyk.io/test/github/joris-van-der-wel/bluefox/badge.svg)](https://snyk.io/test/github/joris-van-der-wel/bluefox)

The bluefox library lets you be notified when a DOM tree has reached a specific condition, using a convenient syntax. It has been designed for high accuracy and low overhead.

The functionality is similar to the wait functions found in many WebDriver/Selenium client libraries. Unlike most of those libraries, bluefox does not employ periodic polling. Also, instead of sending many commands over the network during the wait, the resolving of wait conditions in bluefox takes place entirely in the browser. This means that the moment the wait condition resolves is a lot closer to the actual change.

The overhead that this library introduces to the page being tested is kept as low as possible.

## Examples
```
npm i bluefox
```

### Webpack / Browserify
```javascript
// browserify / webpack / jsdom
const Bluefox = require('bluefox');
const wait = new Bluefox().target(window);
wait.timeout('5s').selector('section#main > div.contactInformation > a.viewProfile').then(link => {
  link.click();
}).catch(err => {
  console.error('uh o', err);
});
```

### HTML Document
```html
<!DOCTYPE html>
<html>
<head>
  <title>Hi!</title>
  <script src="node_modules/bluefox/standalone.js"></script>
  <!-- <script src="node_modules/bluefox/standalone.min.js"></script> -->
  <script>
    (async () => {
      console.log(new Date(), 'Waiting...');
      const wait = new Bluefox().target(window);
      const element = await wait.timeout('5s').selector('#foo > strong');
      element.textContent = 'wereld!!';
      console.log(new Date(), 'Done!');
    })();
  </script>
</head>
<body>
<div id="foo">
  Hello
</div>
<script>
  setTimeout(() => {
    foo.insertAdjacentHTML(
        'beforeend',
        '<strong>world</strong>'
    )
  }, 1000);
</script>
</body>
```

### WebDriver
```javascript
const bluefoxString = require('bluefox/standalone.string.js');
// const bluefoxString = require('bluefox/standalone.min.string.js');
const wd = require('wd');
const browser = wd.promiseRemote('http://localhost:9515');
(async () => {
  await browser.init({pageLoadStrategy: 'none'});
  await browser.setAsyncScriptTimeout(30000);
  await browser.get(`http://example.com`);
  await browser.execute(bluefoxString);
  await browser.execute(`wait = new Bluefox().target(window).timeout('10s')`);
  const result = await browser.executeAsync(`
    const resolve = arguments[arguments.length - 1];
    wait.documentComplete().selector('p > a[href]')
      .then(() => resolve({okay: true}))
      .catch(err => resolve({error: err.toString()}))
  `);
  console.log('result:', result);
})();
```

## API
TODO
