'use strict';

/* global BLUEFOX_TEST_ENV */

const {describe, specify, afterEach} = require('mocha-sugar-free');

const {mean, standardDeviation} = require('../statistics');
const BluefoxInstrumented = require('./BluefoxInstrumented');

const {navigate, closeWindow, getWindow} = BLUEFOX_TEST_ENV;

describe('Waiting for a single xpath', {timeout: 60000}, () => {
    afterEach(async () => {
        await closeWindow();
    });

    specify('single mutation', async () => {
        const ITERATIONS = 100;
        const bluefox = new BluefoxInstrumented();
        const result = [];
        await navigate('static/static-text.html');
        const window = await getWindow();
        await bluefox.target(window).documentComplete();

        const waitExpression = bluefox.target(window).timeout('5s').xpath(
            // body > p strong em.foo.bar
            `.//body/p//strong//em` +
            `[(contains(concat(' ', normalize-space(./@class), ' '), ' foo ') and` +
            `  contains(concat(' ', normalize-space(./@class), ' '), ' bar '))]`
        );
        const container = window.document.body.children[10];
        const newChild = window.document.createElement('strong');
        newChild.innerHTML = `<em class="foo bar">Tema tis rolod muspi merol</em>`;

        for (let iteration = 0; iteration < ITERATIONS; ++iteration) {
            let eventTime = NaN;
            setTimeout(() => {
                container.appendChild(newChild);
                eventTime = window.performance.now();
            }, Math.random() * 100);

            await waitExpression;
            const waitCompleteTime = window.performance.now();
            result.push(waitCompleteTime - eventTime);
            newChild.remove();
        }

        const stats = bluefox.getStatistics();
        console.info(
            '!BENCH!',
            'xpath: single mutation',
            result.length,
            mean(result),
            standardDeviation(result),
            stats.checkCount,
            stats.checkOverheadTotal,
            stats.checkOverheadMean,
            stats.checkOverheadStdDev,
        );
    });

    const CASE_MP_ITERATIONS = 10;
    specify('Case: MP', {timeout: CASE_MP_ITERATIONS * 10000, slow: CASE_MP_ITERATIONS * 4000}, async () => {
        const bluefox = new BluefoxInstrumented();
        const results = [[], [], [], [], [], [], []];

        let window;
        const progress = new Map();
        const currentResult = new Map();
        const reportProgress = key => progress.set(key, window.performance.now());

        const baseExpression = bluefox.target(() => window).timeout('10s');
        const waitExpressions = [
            // 0: ads.js DOM modification 1
            baseExpression.selector('body > section > #async-content-foo em.async-content-foo-foo-1'),

            // 1: ads.js DOM modification 7
            baseExpression.selector('body > section > #async-content-foo em.async-content-foo-7'),

            // 2: inline DOM modification 1
            baseExpression.selector('#async-content-baz strong > .async-content-baz-1'),

            // 3: inline DOM modification 7
            baseExpression.selector('.async-content-baz-7'),

            // 4: gtm.js DOM modification 1
            baseExpression.selector('.async-content-bar-1-2'),

            // 5: gtm.js DOM modification 5
            baseExpression.selector('section em.async-content-bar-5'),

            // 6: gtm.js DOM modification 6
            baseExpression.selector('body > section > #async-content-bar em.async-content-bar-6'),
        ];

        for (let iteration = 0; iteration < CASE_MP_ITERATIONS; ++iteration) {
            console.log(new Date(), 'iteration', iteration);
            currentResult.clear();
            progress.clear();
            await navigate('static/mp/home.html');
            window = await getWindow();
            window.reportProgress = reportProgress;

            await waitExpressions[0];
            results[0].push(window.performance.now() - progress.get('ads.js DOM modification 1'));

            await waitExpressions[1];
            results[1].push(window.performance.now() - progress.get('ads.js DOM modification 7'));

            await waitExpressions[2];
            results[2].push(window.performance.now() - progress.get('inline DOM modification 1'));

            await waitExpressions[3];
            results[3].push(window.performance.now() - progress.get('inline DOM modification 7'));

            await waitExpressions[4];
            results[4].push(window.performance.now() - progress.get('gtm.js DOM modification 1'));

            await waitExpressions[5];
            results[5].push(window.performance.now() - progress.get('gtm.js DOM modification 5'));

            await waitExpressions[6];
            results[6].push(window.performance.now() - progress.get('gtm.js DOM modification 6'));
        }

        const stats = bluefox.getStatistics();
        for (let i = 0; i < results.length; ++i) {
            console.info(
                '!BENCH!',
                `xpath: case MP (${i})`,
                results[i].length,
                mean(results[i]),
                standardDeviation(results[i]),
                '',
                '',
                '',
                '',
            );
        }

        const allResults = [].concat(...results);
        console.info(
            '!BENCH!',
            `xpath: case MP`,
            allResults.length,
            mean(allResults),
            standardDeviation(allResults),
            stats.checkCount,
            stats.checkOverheadTotal,
            stats.checkOverheadMean,
            stats.checkOverheadStdDev,
        );
    });
});
