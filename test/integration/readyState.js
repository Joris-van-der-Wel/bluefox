'use strict';
/* global BLUEFOX_TEST_ENV */

const {describe, it, beforeEach, afterEach} = require('mocha-sugar-free');
const {assert: {strictEqual: eq}, assert} = require('chai');

const {navigate, closeWindow, environment, run, getProgress} = BLUEFOX_TEST_ENV;

describe('Waiting for document.readyState', {timeout: 10000, slow: 2000}, () => {
    beforeEach(async () => {
        await navigate('static/readyState.html');
        await run(async scope => {
            const {window, Bluefox} = scope;
            const bluefox = new Bluefox();
            scope.wait = bluefox.target(window);
        });
    });

    afterEach(async () => {
        await closeWindow();
    });

    // 'This test does not function properly in jsdom (spec violations)':
    it('should wait for documentInteractive', {skip: environment === 'jsdom'}, async testContext => {
        await run(async ({delay, wait, reportProgress}) => {
            await wait.timeout('5s').documentInteractive();
            reportProgress('after wait');
            await delay(0);
        });
        const progress = await getProgress();

        console.log('should wait for documentInteractive progress=', JSON.stringify(progress, null, 2));
        eq(progress[0], 'HEAD begin');
        eq(progress[1], 'foo script');
        eq(progress[2], 'BODY end');
        assert(
            (progress[3] === 'after wait' && progress[4] === 'DOMContentLoaded') ||
            (progress[4] === 'after wait' && progress[3] === 'DOMContentLoaded')
        );

        // repeating the same wait expression should not fail
        await run(async ({wait}) => { await wait.timeout(100).documentInteractive(); });
    });

    it('should wait for documentInteractive (jsdom)', {skip: environment !== 'jsdom'}, async testContext => {
        await run(async ({delay, wait, reportProgress}) => {
            await wait.timeout('3s').documentInteractive();
            reportProgress('after wait');
            delay(0);
        });
        const progress = await getProgress();

        const progressFiltered = progress.filter(value =>
            // jsdom only loads images if an optional packages installed, and even in that case it loads images
            // before everything else
            value !== 'img loaded' &&
            // "load" is always fired at the same time as DOMContentLoaded because of these issues ^
            value !== 'load'
        );

        // console.log(JSON.stringify(progress, null, 2));
        eq(progressFiltered[0], 'HEAD begin');
        eq(progressFiltered[1], 'foo script');
        eq(progressFiltered[2], 'BODY end');
        assert(
            (progressFiltered[3] === 'after wait' && progressFiltered[4] === 'DOMContentLoaded') ||
            (progressFiltered[4] === 'after wait' && progressFiltered[3] === 'DOMContentLoaded'),
            'last two progress items must be "after wait" and "DOMContentLoaded"'
        );

        // repeating the same wait expression should not fail
        await run(async ({wait}) => { await wait.timeout(100).documentInteractive(); });
    });

    // 'This test does not function properly in jsdom (spec violations)':
    it('should wait for documentComplete', {skip: environment === 'jsdom'}, async testContext => {
        await run(async ({delay, wait, reportProgress}) => {
            await wait.timeout('5s').documentComplete();
            reportProgress('after wait');
            await delay(0);
        });
        const progress = await getProgress();

        console.log('should wait for documentComplete progress=', JSON.stringify(progress, null, 2));
        eq(progress[0], 'HEAD begin');
        eq(progress[1], 'foo script');
        eq(progress[2], 'BODY end');
        eq(progress[3], 'DOMContentLoaded');
        eq(progress[4], 'img loaded');
        assert(
            (progress[5] === 'after wait' && progress[6] === 'load') ||
            (progress[6] === 'after wait' && progress[5] === 'load')
        );

        // repeating the same wait expression should not fail
        await run(async ({wait}) => { await wait.timeout(100).documentComplete(); });
    });

    it('should wait for documentComplete (jsdom)', {skip: environment !== 'jsdom'}, async testContext => {
        await run(async ({delay, wait, reportProgress}) => {
            await wait.timeout('3s').documentComplete();
            reportProgress('after wait');
            await delay(0);
        });
        const progress = await getProgress();

        const progressFiltered = progress.filter(value =>
            // jsdom only loads images if an optional packages installed, and even in that case it loads images
            // before everything else
            value !== 'img loaded'
        );
        // console.log(JSON.stringify(progress, null, 2));
        eq(progressFiltered[0], 'HEAD begin');
        eq(progressFiltered[1], 'foo script');
        eq(progressFiltered[2], 'BODY end');
        eq(progressFiltered[3], 'DOMContentLoaded');
        assert(
            (progress[4] === 'after wait' && progress[5] === 'load') ||
            (progress[5] === 'after wait' && progress[4] === 'load')
        );

        // repeating the same wait expression should not fail
        await run(async ({wait}) => { await wait.timeout(100).documentComplete(); });
    });
});
