'use strict';
/* global BLUEFOX_TEST_ENV */

const {describe, it, beforeEach, afterEach} = require('mocha-sugar-free');
const {assert: {isBelow, isAtLeast}} = require('chai');

const {navigate, closeWindow, run, getProgress} = BLUEFOX_TEST_ENV;

describe('Waiting for a CSS Selector', {slow: 2000, timeout: 20000}, () => {
    beforeEach(async () => {
    });

    afterEach(async () => {
        await closeWindow();
    });

    it('Should wait for an element added after a delay', async () => {
        await navigate('static/mutation-add-element.html');
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector('strong#modification');
            reportProgress('after wait 0');
        });
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector('strong#modification');
            reportProgress('after wait 1');
        });
        const progress = await getProgress();

        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait 0'), 0);
        isAtLeast(progress.indexOf('after wait 1'), 0);
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 0'));
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 1'));
    });

    it('Should wait for an element added during DOMContentLoaded', async () => {
        await navigate('static/mutation-add-element-at-interactive.html');
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector('strong#modification');
            reportProgress('after wait 0');
        });
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector('strong#modification');
            reportProgress('after wait 1');
        });
        const progress = await getProgress();

        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait 0'), 0);
        isAtLeast(progress.indexOf('after wait 1'), 0);
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 0'));
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 1'));
    });

    it('Should wait for an element added deep in the tree after a delay', async () => {
        await navigate('static/mutation-add-element-deep.html');
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector('body ul > li#modification');
            reportProgress('after wait');
        });
        const progress = await getProgress();

        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait'), 0);

        isBelow(progress.indexOf('modification'), progress.indexOf('after wait'));
    });

    it('Should wait for an element removed after a delay', async () => {
        await navigate('static/mutation-remove-element.html');
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').documentInteractive().selector('#thirdP').amount(0);
            reportProgress('after wait');
        });
        const progress = await getProgress();

        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait'), 0);

        isBelow(progress.indexOf('modification'), progress.indexOf('after wait'));
    });

    it('Should wait for an element removed deep in the tree after a delay', async () => {
        await navigate('static/mutation-remove-element-deep.html');
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').documentInteractive().selector('body ul > #firstLi').amount(0);
            reportProgress('after wait');
        });
        const progress = await getProgress();

        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait'), 0);

        isBelow(progress.indexOf('modification'), progress.indexOf('after wait'));
    });

    it('Should wait for an attribute set after a delay', async () => {
        await navigate('static/mutation-set-attribute.html');
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector('p.modification');
            reportProgress('after wait');
        });
        const progress = await getProgress();

        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait'), 0);

        isBelow(progress.indexOf('modification'), progress.indexOf('after wait'));
    });
});
