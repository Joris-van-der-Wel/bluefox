'use strict';
/* global BLUEFOX_TEST_ENV */

const {describe, it, beforeEach, afterEach} = require('mocha-sugar-free');
const {assert: {isBelow, isAtLeast, deepEqual: deq, strictEqual: eq}} = require('chai');

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

    it('Should wait for a changed Text node', async () => {
        await navigate('static/mutation-change-text.html');
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector('#secondP').containsText('Replaced the text');
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

    it('Should perform escaping if a tagged template literal is passed', async () => {
        await navigate('static/mutation-add-element.html');
        await run(async ({window, Bluefox, reportProgress}) => {
            await new Bluefox().target(window).timeout('10s').selector`strong[data-with-special-chars=${'123 #bla'}]`;
            reportProgress('after wait 0');
        });
        const progress = await getProgress();

        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait 0'), 0);
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 0'));
    });

    it('Should wait for multiple elements', async () => {
        await navigate('static/mutation-add-element.html');

        {
            const elements = await run(async ({window, Bluefox, reportProgress}) => {
                const elements = await new Bluefox().target(window).timeout('10s').selectorAll('p, strong').amount(4);
                reportProgress('after wait 0');
                return elements.map(element => element.id);
            });
            deq(elements, ['firstP', 'modification', 'secondP', 'thirdP']);
        }
        {
            const elements = await run(async ({window, Bluefox, reportProgress}) => {
                const elements = await new Bluefox().target(window).timeout('10s').selectorAll('p, strong').amount(4);
                reportProgress('after wait 1');
                return elements.map(element => element.id);
            });
            deq(elements, ['firstP', 'modification', 'secondP', 'thirdP']);
        }

        const progress = await getProgress();
        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait 0'), 0);
        isAtLeast(progress.indexOf('after wait 1'), 0);
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 0'));
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 1'));
    });

    it('Should wait for multiple elements but returning only the first', async () => {
        await navigate('static/mutation-add-element.html');

        const element = await run(async ({window, Bluefox, reportProgress}) => {
            const element = await new Bluefox().target(window).timeout('10s').selectorAll('p, strong').amount(4).first();
            reportProgress('after wait 0');
            return element.id;
        });
        eq(element, 'firstP');

        const progress = await getProgress();
        isAtLeast(progress.indexOf('modification'), 0);
        isAtLeast(progress.indexOf('after wait 0'), 0);
        isBelow(progress.indexOf('modification'), progress.indexOf('after wait 0'));
    });
});
