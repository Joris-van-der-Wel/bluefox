'use strict';
/* eslint-env node */

const wd = require('wd');

const bluefoxStringified = require('../../../standalone.string.js');

const executeAsync = async (browser, func, compiledArgs = '[]', args = []) => {
    const funcString = func.toString();
    const body =
        '(f=>{' +
            'const r=arguments[arguments.length-1];' +
            `const c=(${compiledArgs});` +
            'const a=Array.prototype.slice.call(arguments,0,arguments.length-1);' +
            'Promise.resolve(f(...c,...a))' +
            '.then(' +
                'v=>r({resolve:v}),' +
                'e=>{' +
                    'if(!e)r({reject:e});' +
                    'else r({reject:{' +
                        'message:e.message,' +
                        'name:e.name,' +
                        'stack:e.stack' +
                    '}})' +
                '}' +
            ');' +
        `})(${funcString});`;
    const result = await browser.executeAsync(body, args);
    if ('reject' in result) {
        const error = Error(result.reject.message);
        error.name = result.reject.name;
        error.stack += '\nCaused by remote:\n' + result.reject.stack;
        throw error;
    }
    return result.resolve;
};

if (!process.env.WD_URL) {
    console.error('WD_URL environment variable must be set');
    process.exit(1);
}

console.log('Using webdriver at:', process.env.WD_URL);
const browser = wd.promiseRemote(process.env.WD_URL);
let browserActive = false;

if (process.env.WD_DEBUG_LOG === '1') {
    browser.on('status', info => console.log('WD status:', info));
    browser.on('command', (eventType, command, response) => console.log('WD command: ', eventType, command, response));
    browser.on('http', (method, path, data) => console.log('WD http: ' + method, path, data));
}

global.BLUEFOX_TEST_ENV = {
    environment: 'webdriver',
    navigate: async path => {
        if (browserActive) {
            await global.BLUEFOX_TEST_ENV.closeWindow();
        }

        await browser.init({
            pageLoadStrategy: 'none', // do not wait for any kind of document readyState during .get()
        });
        browserActive = true;
        await browser.setAsyncScriptTimeout(30000);
        await browser.get(`http://127.0.0.1:8123/${path}`);
        await browser.execute(bluefoxStringified);
        await browser.execute(`
        (() => {
            const progress = window.progressBeforeInit ? [...window.progressBeforeInit] : [];
            const reportProgress = key => progress.push(key);
            window.reportProgress = reportProgress;
            bluefoxTestScope = {
                window,
                progress,
                reportProgress,
                delay: ms => new Promise(resolve => setTimeout(resolve, ms)),
                Bluefox,
            };
        })()`);
    },
    closeWindow: async () => {
        await browser.quit();
        browserActive = false;
    },
    run: async (func, ...args) => {
        return await executeAsync(browser, func, '[bluefoxTestScope]', args);
    },
    getProgress: async () => {
        return await browser.execute('return bluefoxTestScope.progress');
    },
};

require('../manifest'); // eslint-disable-line import/no-unassigned-import
