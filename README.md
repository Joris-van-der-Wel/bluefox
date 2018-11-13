# Bluefox
[![Build Status](https://travis-ci.org/Joris-van-der-Wel/bluefox.svg?branch=master)](https://travis-ci.org/Joris-van-der-Wel/bluefox) [![Coverage Status](https://coveralls.io/repos/github/Joris-van-der-Wel/bluefox/badge.svg?branch=master)](https://coveralls.io/github/Joris-van-der-Wel/bluefox?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/Joris-van-der-Wel/bluefox.svg)](https://greenkeeper.io/) [![Known Vulnerabilities](https://snyk.io/test/github/joris-van-der-wel/bluefox/badge.svg)](https://snyk.io/test/github/joris-van-der-wel/bluefox)

The bluefox library lets you be notified when a DOM tree has reached a specific condition, using a convenient syntax. It has been designed for high accuracy and low overhead.

The functionality is similar to the wait functions found in many WebDriver/Selenium client libraries. Unlike most of those libraries, bluefox does not employ periodic polling. Also, instead of sending many commands over the network during the wait, the resolving of wait conditions in bluefox takes place entirely in the browser. This means that the moment the wait condition resolves is a lot closer to the actual change.

The overhead that this library introduces to the page being tested is kept as low as possible.

## Examples
```
npm i bluefox
```

### Webpack / Browserify / node.js (jsdom)
```javascript
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
First, this library must by instantiated by calling its constructor:

```javascript
const Bluefox = require('bluefox');
const wait = new Bluefox();
```

Wait conditions are then defined by chaining together `actions` to form an `expression`. An `expression` is executed by consuming it as a Promise (`expression.then(...)`, `await expression`, etc).

During execution the `current value` is consumed and/or modified by the actions that make up the expression; the output of an action is used as the input of the next action. The `current value` must be either:

 * `null`
 * A `WindowProxy` instance
 * A `HTMLDocument` instance
 * An `Element` instance
 * An array of `WindowProxy`, `HTMLDocument`, `Element` instances

For example the expression `await wait.target(document.body).selector('div').selector('p')` returns the first `<p>` element that is a descendant of the first `<div>` element that is the first descendant of the document's `<body>` element.

Some actions may cause the execution to remain pending based on their input value. For example `await wait.target(document).documentInteractive()` delays the fulfillment of the execution until the HTML of the document has been completely parsed (DOMContentLoaded).

An expression is immutable. This lets you execute it multiple times or base a new expression of an existing one.

### Available actions
#### .timeout(duration)
This action sets the timeout for all subsequent actions. If the timeout duration is reached, the Promise of the `execution` rejects with an `Error`. If this action is not specified, a default timeout of 30 seconds is used.

```javascript
await wait.target(document).documentComplete(); // 30 second timeout
await wait.target(document).timeout('1s').documentComplete(); // 1 second timeout
await wait.target(document).timeout(1500).documentComplete(); // 1.5 second timeout
```

The error object contains the following properties:
```javascript
const expression = await wait.target(document).timeout('1.2s').documentComplete();
const fullExpression = expression.selector('body');
try {
  await fullExpression;
}
catch (err) {
  console.log(err.name); // String("BluefoxTimeoutError")
  console.log(err.message); // String("Wait expression timed out after 1.2 seconds because the HTML document has not yet been parsed")
  console.log(err.actionFailure); // String("the HTML document has not yet been parsed")
  console.log(err.timeout); // Number(1200) - milliseconds
  console.log(err.expression === expression); // Boolean(true)
  console.log(err.fullExpression === fullExpression); // Boolean(true)
}
```


#### .target(value)
The target action is used to simply set the `current value`. It is almost always used as the first action in the chain.

```javascript
await wait.target(window).selector('html')
await wait.target(document).documentInteractive()
await wait.target(document.body).check(body => body.classList.contains('foo'))
await wait.target([someElement, anotherElement]).selectorAll('p')
```

#### .amount(minimum, maximum)
This action causes the execution to remain pending if the `current value` has less than `minimum` or more than `maximum` objects.  If this action is not specified, the execution waits until `current value` contains 1 or more objects.  The `current value` is not modified by this action.

```javascript
await wait.target(window).selectorAll('img.thumbnail') // 1 or more
await wait.target(window).selectorAll('img.thumbnail').amount(1, Infinity) // 1 or more
await wait.target(window).selectorAll('img.thumbnail').amount(1) // exactly 1
await wait.target(window).selectorAll('img.thumbnail').amount(0) // exactly 0
await wait.target(window).selectorAll('img.thumbnail').amount(2, 4) // 2 or 3 or 4
```

#### .selector(cssSelector)
Return the first `Element` (or `null`) that matches the given CSS selector and is a descendant of any objects in `current value`.

```javascript
const link = await wait.target(window).selector('a.someLink');
link.click();

const anotherLink = await wait.target([someElement, anotherElement]).selector('a.someLink');
anotherLink.click();

const needsSomeEscaping = '#"b[l]a'
await wait.target(window).selector`div[data-foo=${needsSomeEscaping}]`;
```


#### .selectorAll(cssSelector)
Return all `Element` instances (as an array) that match the given CSS selector and are a descendant of any objects in `current value`.

```javascript
const links = await wait.target(window).selectorAll('.todoList a');
links.forEach(link => link.click());

const needsSomeEscaping = '#"b[l]a'
await wait.target(window).selectorAll`div[data-foo=${needsSomeEscaping}]`;
```

#### .xpath(expression)
Execute the given XPath `expression` setting the `current value` as the XPath `context node` and return the first `Element` instance that matches. A result that is _not_ an `Element` will result in an error.

```javascript
await wait.target(window).xpath(`.//h1[./@id = 'introduction']`);
await wait.target(document.body).xpath(`./p`);
```

_Note: XPath expressions often cause more overhead than CSS Selectors._

#### .xpathAll(expression)
Execute the given XPath `expression` setting the `current value` as the XPath `context node` and return the all `Element` instances that match. A result that is _not_ an `Element` will result in an error.

```javascript
await wait.target(window).xpathAll(`.//a[@href]`).amount(10, Infinity);
await wait.target(document.body).xpathAll(`./p`).amount(0);
```

_Note: XPath expressions often cause more overhead than CSS Selectors._

#### .documentInteractive()
This action causes the execution to remain pending if any of the `HTMLDocument` instances in `current value` have a `readyState` that is not `"interactive"` nor `"complete"`. If the `current value` contains any `Element` instances, the check will be performed on their `ownerDocument`. The `current value` is not modified by this action.

```javascript
window.addEventListener('DOMContentLoaded',
  () => console.log('documentInteractive!')
);
await wait.target(document).documentInteractive();
await wait.target(document.body).documentInteractive();
```

#### .documentComplete()
This action causes the execution to remain pending if any of the `HTMLDocument` instances in `current value` have a `readyState` that is not `"complete"`. If the `current value` contains any `Element` instances, the check will be performed on their `ownerDocument`. The `current value` is not modified by this action.

```javascript
window.addEventListener('load',
  () => console.log('documentComplete!')
);
await wait.target(document).documentComplete();
await wait.target(document.body).documentComplete();
```

#### .delay(duration)
This action causes the execution to remain pending until the given `duration` has passed (since the start of the execution).

```javascript
await wait.delay('2s'); // 2000ms
await wait.delay(2000); // 2000ms
```

#### .isDisplayed()
This action removes all elements from `current value` that are not currently displayed on the page. An element is "displayed" if it influences the rendering of the page. _(Specifically, `element.getBoundingClientRect()` returns a non zero `width` and `height`)._

```javascript
await wait.selector('.submitButton').isDisplayed()
await wait.selectorAll('.gallery img').isDisplayed().amount(10, 50);
```

#### .check(callback)
This action calls the given `callback` function for each item in `current value` and removes all items for which the callback returns `false`.

```javascript
await wait.selector('p.introduction').check(n => /hello/.test(n.textContent))
await wait.selector('img').check(n => n.complete).amount(10, Infinity)
```

#### .containsText(text)
This action removes all elements from `current value` for which the `textContent` does not contain the given `text`.

```javascript
await wait.selector('p.introduction').containsText('hello')
await wait.selector('p.introduction').containsText(/hello/)
await wait.selectorAll('p').containsText('ipsum').amount(10, 50);
```

#### .first()
This action returns the first element (index 0) from `current value`

```javascript
const oneImage = await wait.selectorAll('.gallery img').isDisplayed().first();
const button = await wait.selectorAll('button').check(n => /Confirm Order/i.test(n.textContent)).first()
```
