'use strict';
/* global window */

const Promise = require('bluebird');

const Bluefox = require('../lib/Bluefox.js');

let currentScope;

const documentInteractive = new Promise(resolve => {
    if (window.document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', resolve);
    }
    else {
        resolve();
    }
});
const iframePromise = documentInteractive.then(() => new Promise((resolve, reject) => {
    try {
        const iframe = window.document.createElement('iframe');
        iframe.id = 'bluefoxTest';
        iframe.style.width = '100%';
        iframe.style.height = '800px';
        iframe.onload = () => {
            iframe.onload = null;
            resolve(iframe);
        };
        iframe.src = '/empty';
        window.document.body.appendChild(iframe);
    }
    catch (err) {
        reject(err);
    }
}));

global.BLUEFOX_TEST_ENV = {
    environment: 'karma',
    navigate: async path => {
        // this function assumes that we stay same-origin
        const url = `/${path}`;
        const iframe = await iframePromise;

        await new Promise((resolve, reject) => {
            const oldDocument = iframe.contentDocument;
            iframe.contentWindow.addEventListener('unload', () => setTimeout(() => {
                if (iframe.contentDocument === oldDocument) {
                    reject(Error('Assertion Failed: Expected the navigation to have occurred by now'));
                    return;
                }
                resolve();
            }, 0));

            iframe.src = url;
        });

        const window = iframe.contentWindow;
        const progress = window.progressBeforeInit ? [...window.progressBeforeInit] : [];
        const reportProgress = key => progress.push(key);
        window.reportProgress = reportProgress;
        currentScope = {
            window,
            progress,
            reportProgress,
            delay: Promise.delay,
            Bluefox,
        };
    },
    closeWindow: async () => {
        const iframe = await iframePromise;
        iframe.src = '/empty';
    },
    getWindow: async () => { // only used by benchmarks to avoid the overhead of run()
        const iframe = await iframePromise;
        return iframe.contentWindow;
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
