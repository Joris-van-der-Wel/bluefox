'use strict';

/* global BLUEFOX_TEST_ENV */

const {describe, specify, afterEach} = require('mocha-sugar-free');

const {mean, standardDeviation} = require('../statistics');
const standalone = require('../../standalone.string');
const standaloneMinified = require('../../standalone.min.string');

const {navigate, closeWindow, getWindow} = BLUEFOX_TEST_ENV;

describe('Evaluating this library', {timeout: 60000}, () => {
    afterEach(async () => {
        await closeWindow();
    });

    describe('in a new browsing context', () => {
        const ITERATIONS = 250;

        specify('standalone.js', async () => {
            const result = [];

            for (let iteration = 0; iteration < ITERATIONS; ++iteration) {
                await navigate('static/static-text.html');
                const window = await getWindow();
                const before = window.performance.now();
                window.eval(standalone);
                const after = window.performance.now();
                result.push(after - before);
            }

            console.info(
                '!BENCH!',
                'lib-evaluation: new browsing context: standalone.js',
                result.length,
                mean(result),
                standardDeviation(result),
                '',
                '',
                '',
                '',
            );
        });

        specify('standalone.min.js', async () => {
            const result = [];

            for (let iteration = 0; iteration < ITERATIONS; ++iteration) {
                await navigate('static/static-text.html');
                const window = await getWindow();
                const before = window.performance.now();
                window.eval(standaloneMinified);
                const after = window.performance.now();
                result.push(after - before);
            }

            console.info(
                '!BENCH!',
                'lib-evaluation: new browsing context: standalone.min.js',
                result.length,
                mean(result),
                standardDeviation(result),
                '',
                '',
                '',
                '',
            );
        });
    });
});
