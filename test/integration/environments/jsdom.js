'use strict';

const {JSDOM} = require('jsdom');
const Promise = require('bluebird');

const Bluefox = require('../../../');
const createMutationObserverMock = require('../../createMutationObserverMock');

let currentWindow;
let currentScope;

global.BLUEFOX_TEST_ENV = {
    environment: 'jsdom',
    navigate: async path => new Promise((resolve, reject) => {
        JSDOM.fromURL(`http://127.0.0.1:8123/${path}`, {
            resources: 'usable',
            runScripts: 'dangerously',
            beforeParse: window => {
                const progress = [];
                const reportProgress = key => progress.push(key);
                window.reportProgress = reportProgress;
                currentScope = {
                    window,
                    progress,
                    reportProgress,
                    delay: Promise.delay,
                    Bluefox,
                };

                if (!window.MutationObserver) {
                    // not yet supported by jsdom
                    createMutationObserverMock(window);
                }
                currentWindow = window;
                resolve();
            }, // (document.readyState = loading)
        }).catch(reject);
    }),
    closeWindow: async () => {
        try {
            currentWindow && currentWindow.close();
        }
        finally {
            currentWindow = undefined;
            currentScope = undefined;
        }
    },
    run: async (func, ...args) => {
        // break the closure on purpose to mimic the behaviour of the webdriver environment
        // eslint-disable-next-line no-eval
        const funcWithoutClosure = eval(`(${func.toString()})`);
        return await funcWithoutClosure(currentScope, ...args);
    },
    getProgress: async () => {
        return currentScope.progress;
    },
};

require('../manifest'); // eslint-disable-line import/no-unassigned-import
