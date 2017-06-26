'use strict';
/* global BLUEFOX_TEST_ENV */

const {describe, specify, afterEach} = require('mocha-sugar-free');

const {mean, standardDeviation} = require('../statistics');
const BluefoxInstrumented = require('./BluefoxInstrumented');

const {navigate, closeWindow, getWindow} = BLUEFOX_TEST_ENV;

describe('Waiting for document.readyState', {timeout: 60000}, () => {
    const ITERATIONS = 50;

    afterEach(async () => {
        await closeWindow();
    });

    specify('documentInteractive', async () => {
        const bluefox = new BluefoxInstrumented();
        const result = [];

        for (let iteration = 0; iteration < ITERATIONS; ++iteration) {
            await navigate('static/readyState.html');
            const window = await getWindow();
            let eventTime = NaN;
            const domContentLoadedPromise = new Promise(resolve =>
                window.addEventListener('DOMContentLoaded', () => {
                    eventTime = window.performance.now();
                    resolve();
                }, true)
            );
            const wait = bluefox.target(window);

            await wait.timeout('5s').documentInteractive();
            const waitCompleteTime = window.performance.now();
            await domContentLoadedPromise;
            result.push(waitCompleteTime - eventTime);
        }

        const stats = bluefox.getStatistics();
        console.info(
            '!BENCH!',
            'documentInteractive',
            result.length,
            mean(result),
            standardDeviation(result),
            stats.checkCount,
            stats.checkOverheadTotal,
            stats.checkOverheadMean,
            stats.checkOverheadStdDev,
        );
    });

    specify('documentComplete', async () => {
        const bluefox = new BluefoxInstrumented();
        const result = [];

        for (let iteration = 0; iteration < ITERATIONS; ++iteration) {
            await navigate('static/readyState.html');
            const window = await getWindow();
            let eventTime = NaN;
            window.addEventListener('load', () => {eventTime = window.performance.now();}, true);
            const wait = bluefox.target(window);

            await wait.timeout('5s').documentComplete();
            const waitCompleteTime = window.performance.now();
            result.push(waitCompleteTime - eventTime);
        }

        const stats = bluefox.getStatistics();
        console.info(
            '!BENCH!',
            'documentComplete',
            result.length,
            mean(result),
            standardDeviation(result),
            stats.checkCount,
            stats.checkOverheadTotal,
            stats.checkOverheadMean,
            stats.checkOverheadStdDev,
        );
    });
});
