'use strict';
/* global BLUEFOX_TEST_ENV */

const {describe, it, beforeEach, afterEach} = require('mocha-sugar-free');
const {assert: {isBelow, isAtLeast}} = require('chai');

const {navigate, closeWindow, run, getProgress, environment} = BLUEFOX_TEST_ENV;

describe('Waiting an element to be displayed', {slow: 2000, timeout: 20000, skip: environment === 'jsdom'}, () => {
    beforeEach(async () => {
    });

    afterEach(async () => {
        await closeWindow();
    });

    it('Should wait for an element setting display:block after a delay', async () => {
        await navigate('static/mutation-set-displayed.html');
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector('#secondP').isDisplayed();
            reportProgress('after wait 0');
        });
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector('#secondP').timeout('10s').isDisplayed();
            reportProgress('after wait 1');
        });
        const progress = await getProgress();

        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait 0'), 0);
        isAtLeast(progress.indexOf('after wait 1'), 0);
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 0'));
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 1'));
    });
});
