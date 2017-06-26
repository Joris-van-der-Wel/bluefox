# Integration Tests
The tests in this directory are more expensive than our unit tests because they require a full browser. The provided web server must also be running.

The tests are ran in the following environments:

### Within the browser sandbox:
The Bluefox script is ran from within the sandbox of the browser and is testing the page that it is loaded by. Navigation tests are performed using an iframe.

 * Firefox using karma
 * Chrome using karma
 * Other browsers using karma (not included in CI)

### Outside the browser sandbox
The Bluefox script is placed outside the browser sandbox and tests are performed on a sandboxed html document.

 * jsdom (navigation is faked)
 * Firefox using WebDriver
 * Chrome using WebDriver
 * Other browsers using Webdriver (not included in CI)
