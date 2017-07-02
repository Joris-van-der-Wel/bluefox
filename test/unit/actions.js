'use strict';

const {describe, it, before, beforeEach, after, afterEach} = require('mocha-sugar-free');
const {assert: {isNull, isFalse, isTrue, ok, throws, strictEqual: eq, lengthOf, deepEqual, match}} = require('chai');
const jsdom = require('jsdom');
const sinon = require('sinon');

const actions = require('../../lib/actions');
const {RESULT_STATUS_SUCCESS, RESULT_STATUS_PENDING, RESULT_STATUS_FATAL_FAILURE} = require('../../lib/result');

const USE_JSDOM = !global.window;

describe('actions', () => {
    let window;
    let document;

    before(() => {
        window = USE_JSDOM
            ? (new jsdom.JSDOM()).window
            : global.window;
        document = window.document;
    });

    describe('parseTimeoutArgument()', () => {
        it('Should parse number values as milliseconds', () => {
            eq(actions.parseTimeoutArgument(12345), 12345);
        });

        it('Should parse strings in the form of "123s" as seconds', () => {
            eq(actions.parseTimeoutArgument('123s'), 123000);
            eq(actions.parseTimeoutArgument('1.5s'), 1500);
        });

        it('Should throw for invalid values', () => {
            throws(() => actions.parseTimeoutArgument('123'), /invalid.*timeout.*argument/i);
            throws(() => actions.parseTimeoutArgument('foo'), /invalid.*timeout.*argument/i);
            throws(() => actions.parseTimeoutArgument({}), /invalid.*timeout.*argument/i);
            throws(() => actions.parseTimeoutArgument(new Date()), /invalid.*timeout.*argument/i);
            throws(() => actions.parseTimeoutArgument(Symbol()), /invalid.*timeout.*argument/i);
        });
    });

    describe('describeCallback', () => {
        it('Should stringify functions', () => {
            eq(actions.describeCallback(() => 'foo'), '() => \'foo\'');
            // eslint-disable-next-line prefer-arrow-callback
            match(actions.describeCallback(function() { return 1 * 2; }), /^function\s*\(\)\s*{\s*return 1\s*\*\s*2;\s*}$/);
        });

        it('Should trim strings longer than 64 characters', () => {
            eq(
                actions.describeCallback(() => 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
                `() => 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`
            );
            eq(
                actions.describeCallback(() => 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
                `() => 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx…`
            );
        });
    });

    describe('default check', () => {
        it('Should set #wantsDefaultAmountCheck to true for actions that generate new result items', () => {
            isFalse(new actions.Action().wantsDefaultAmountCheck);
            isFalse(new actions.Noop().wantsDefaultAmountCheck);
            isFalse(new actions.Target(null).wantsDefaultAmountCheck);
            isFalse(new actions.Amount(1, 2).wantsDefaultAmountCheck);
            isTrue(new actions.Selector('').wantsDefaultAmountCheck);
            isTrue(new actions.SelectorAll('').wantsDefaultAmountCheck);
            isTrue(new actions.XPath('').wantsDefaultAmountCheck);
            isTrue(new actions.XPathAll('').wantsDefaultAmountCheck);
            isFalse(new actions.DocumentInteractive().wantsDefaultAmountCheck);
            isFalse(new actions.DocumentComplete().wantsDefaultAmountCheck);
            isFalse(new actions.Delay(123).wantsDefaultAmountCheck);
            isFalse(new actions.IsDisplayed().wantsDefaultAmountCheck);
        });

        it('Should set #appliesAmountCheck to true for actions that check the amount', () => {
            isFalse(new actions.Action().appliesAmountCheck);
            isFalse(new actions.Noop().appliesAmountCheck);
            isFalse(new actions.Target(null).appliesAmountCheck);
            isTrue(new actions.Amount(1, 2).appliesAmountCheck);
            isFalse(new actions.Selector('').appliesAmountCheck);
            isFalse(new actions.SelectorAll('').appliesAmountCheck);
            isFalse(new actions.XPath('').appliesAmountCheck);
            isFalse(new actions.XPathAll('').appliesAmountCheck);
            isFalse(new actions.DocumentInteractive().appliesAmountCheck);
            isFalse(new actions.DocumentComplete().appliesAmountCheck);
            isFalse(new actions.Delay(123).appliesAmountCheck);
            isFalse(new actions.IsDisplayed().appliesAmountCheck);
        });
    });

    describe('additionalCheckTimeout', () => {
        it('Should set #additionalCheckTimeout for delay based actions', () => {
            deepEqual(new actions.Action().additionalCheckTimeout, []);
            deepEqual(new actions.Noop().additionalCheckTimeout, []);
            deepEqual(new actions.Target(null).additionalCheckTimeout, []);
            deepEqual(new actions.Amount(1, 2).additionalCheckTimeout, []);
            deepEqual(new actions.Selector('').additionalCheckTimeout, []);
            deepEqual(new actions.SelectorAll('').additionalCheckTimeout, []);
            deepEqual(new actions.XPath('').additionalCheckTimeout, []);
            deepEqual(new actions.XPathAll('').additionalCheckTimeout, []);
            deepEqual(new actions.DocumentInteractive().additionalCheckTimeout, []);
            deepEqual(new actions.DocumentComplete().additionalCheckTimeout, []);
            deepEqual(new actions.Delay(123).additionalCheckTimeout, [123]);
            deepEqual(new actions.IsDisplayed().additionalCheckTimeout, []);
        });
    });

    describe('Action Base', () => {
        describe('#execute()', () => {
            it('Should as a default, result in success and not modify the current result', () => {
                const action = new actions.Action();
                ok(!Object.isFrozen(action));

                const result = action.execute(document);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === document);
            });
        });

        it('Should as a default, return nothing so that its description will be skipped by Expression', () => {
            eq(new actions.Action().describe(), '');
        });
    });

    describe('Noop', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.Noop()));
        });

        describe('#execute()', () => {
            it('Should result in success and not modify the current result', () => {
                const action = new actions.Noop();
                ok(Object.isFrozen(action));

                const result = action.execute(document);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === document);
            });
        });

        describe('#describe()', () => {
            it('Should return nothing so that its description will be skipped by Expression', () => {
                eq(new actions.Noop().describe(), '');
            });
        });
    });

    describe('Target', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.Target(document.body)));
            ok(Object.isFrozen((new actions.Target([document.body])).results));
        });

        describe('#execute()', () => {
            it('Should replace the current result with a single resultItem', () => {
                const action = new actions.Target(document.body);
                const result = action.execute(document);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === document.body);
            });

            it('Should replace the current result with an array of resultItems', () => {
                const action = new actions.Target([document.body, document.head]);
                const result = action.execute(document);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Array.isArray(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === document.body);
                ok(result.value[1] === document.head);
            });

            it('Should replace the current result with a single resultItem from a callback', () => {
                const action = new actions.Target(() => document.body);
                const result = action.execute(document);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === document.body);
            });

            it('Should replace the current result with null', () => {
                const action = new actions.Target(null);
                const result = action.execute(document);
                eq(result.status, RESULT_STATUS_SUCCESS);
                isNull(result.value);
            });

            it('Should result in an error if the callback returns something that is not a result item', () => {
                const action = new actions.Target(() => 123);
                const result = action.execute(document);
                eq(result.status, RESULT_STATUS_FATAL_FAILURE);
                ok(result.value === null);
                deepEqual(result.reasonStrings, [
                    'a value that is not a WindowProxy nor a HTMLDocument, nor an Element was set as the target',
                ]);
                deepEqual(result.reasonValues, []);
            });
        });

        describe('#describe()', () => {
            it('Should describe a single result item', () => {
                eq(new actions.Target(window).describe(), 'sets the target to <#window>');
                eq(new actions.Target(document).describe(), 'sets the target to <#document>');
                eq(new actions.Target(document.createElement('h1')).describe(), 'sets the target to <h1>');
            });

            it('Should describe an array of result items', () => {
                eq(new actions.Target([window]).describe(), 'sets the target to [<#window>]');
                eq(new actions.Target([window, document]).describe(), 'sets the target to [<#window>, <#document>]');
                eq(
                    new actions.Target([
                        document.createElement('h1'),
                        document.createElement('h2'),
                        document.createElement('h3'),
                        document.createElement('h4'),
                        document.createElement('h5'),
                    ]).describe(),
                    'sets the target to [<h1>, <h2>, <h3>, <h4>, <h5>]'
                );
                eq(
                    new actions.Target([
                        document.createElement('h1'),
                        document.createElement('h2'),
                        document.createElement('h3'),
                        document.createElement('h4'),
                        document.createElement('h5'),
                        document.createElement('h6'),
                    ]).describe(),
                    'sets the target to [<h1>, <h2>, <h3>, <h4>, <h5>, …]'
                );
            });

            it('Should describe a callback', () => {
                eq(new actions.Target(() => window).describe(), 'sets the target using a callback: `() => window`');
            });
        });
    });

    describe('Amount', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.Amount(1, 1)));
        });

        it('Should throw for invalid amount arguments', () => {
            throws(() => new actions.Amount(), /amount.*minimum.*must.*number/i);
            throws(() => new actions.Amount('foo', 123), /amount.*minimum.*must.*number/i);
            throws(() => new actions.Amount(() => 123, 123), /amount.*minimum.*must.*number/i);
            throws(() => new actions.Amount(123, 'foo'), /amount.*maximum.*must.*number/i);
            throws(() => new actions.Amount(10, 5), /amount.*maximum.*greater.*equal.*minimum/i);
        });

        it('Should set the maximum to minimum by default', () => {
            const action = new actions.Amount(123);
            eq(action.minimum, 123);
            eq(action.maximum, 123);
        });

        describe('#execute()', () => {
            it('Should not modify the currentResult if the check succeeds', () => {
                const action = new actions.Amount(2, 10);
                const result = action.execute([document.body, document.head]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                lengthOf(result.value, 2);
                ok(result.value[0] === document.body);
                ok(result.value[1] === document.head);
            });

            it('Should succeed if the maximum is 0 and there are no results', () => {
                const action = new actions.Amount(0, 0);
                const result = action.execute(null);
                eq(result.status, RESULT_STATUS_SUCCESS);

                const result2 = action.execute([]);
                eq(result2.status, RESULT_STATUS_SUCCESS);
            });

            it('Should be pending if there are not enough results (single value)', () => {
                const action = new actions.Amount(1, 10);
                const result = action.execute(null);
                eq(result.status, RESULT_STATUS_PENDING);
                ok(result.value === null);
                deepEqual(result.reasonStrings, ['no results were found, instead of a minimum of ', ' results']);
                deepEqual(result.reasonValues, [1]);
            });

            it('Should be pending if there too many results (single value)', () => {
                const action = new actions.Amount(0, 0);
                const result = action.execute(window);
                eq(result.status, RESULT_STATUS_PENDING);
                ok(result.value === null);
                deepEqual(result.reasonStrings, ['', ' results were found, instead of a maximum of ', ' results']);
                deepEqual(result.reasonValues, [1, 0]);
            });

            it('Should be pending if there are not enough results (array)', () => {
                const action = new actions.Amount(2, 10);
                const result = action.execute([document.body]);
                eq(result.status, RESULT_STATUS_PENDING);
                ok(result.value === null);
                deepEqual(result.reasonStrings, ['only ', ' results were found, instead of a minimum of ', ' results']);
                deepEqual(result.reasonValues, [1, 2]);
            });

            it('Should be pending if there too many results (array)', () => {
                const action = new actions.Amount(0, 2);
                const result = action.execute([document.body, document.head, document.createElement('div')]);
                eq(result.status, RESULT_STATUS_PENDING);
                ok(result.value === null);
                deepEqual(result.reasonStrings, ['', ' results were found, instead of a maximum of ', ' results']);
                deepEqual(result.reasonValues, [3, 2]);
            });

            it('Should properly handle a maximum of infinity', () => {
                const action = new actions.Amount(2, Infinity);
                const result = action.execute([document.body, document.head]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                lengthOf(result.value, 2);
                ok(result.value[0] === document.body);
                ok(result.value[1] === document.head);
            });
        });

        describe('#describe()', () => {
            it('Should describe the amount to wait with the timeout', () => {
                eq(new actions.Amount(1).describe(1500), 'waits up to 1.5 seconds until exactly 1 results are found');
                eq(new actions.Amount(1, Infinity).describe(1000), 'waits up to 1 seconds until a result is found');
                eq(new actions.Amount(2, Infinity).describe(30000), 'waits up to 30 seconds until 2 or more results are found');
                eq(
                    new actions.Amount(2, 5).describe(3000),
                    'waits up to 3 seconds until between 2 and 5 (inclusive) results are found'
                );
            });
        });
    });

    describe('Selector', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.Selector('foo')));
        });

        describe('#execute()', () => {
            let foo;
            let fooA;
            let fooB;
            let bar;
            let barA;
            let barB;

            beforeEach(() => {
                foo = document.createElement('div');
                fooA = document.createElement('div');
                fooB = document.createElement('div');
                fooA.className = 'foo';
                fooB.className = 'foo';
                foo.appendChild(fooA);
                foo.appendChild(fooB);

                bar = document.createElement('div');
                barA = document.createElement('div');
                barB = document.createElement('div');
                barA.className = 'bar';
                barB.className = 'bar';
                bar.appendChild(barA);
                bar.appendChild(barB);
            });

            it('Should result in success with a value of null if there is no match', () => {
                const action = new actions.Selector('div#nomatch');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === null);
            });

            it('Should result in the first match of the given CSS selector', () => {
                const action = new actions.Selector('div.foo');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === fooA);
            });

            it('Should result in the first match of the given CSS selector', () => {
                const action = new actions.Selector('div');
                const result = action.execute([foo, bar]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === fooA);
            });

            it('Should result in the first match of the given CSS selector', () => {
                const action = new actions.Selector('div.bar');
                const result = action.execute([foo, bar]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === barA);
            });

            it('Should use the CSS selector returned by a callback', () => {
                const action = new actions.Selector(() => '.foo');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === fooA);
            });
        });

        describe('#describe()', () => {
            it('Should describe the selector match', () => {
                eq(
                    new actions.Selector('foo > bar').describe(),
                    'finds the first descendant element matching the CSS selector “foo > bar”'
                );
            });

            it('Should describe a callback', () => {
                eq(
                    new actions.Selector(() => 'foo > bar').describe(),
                    'finds the first descendant element matching a CSS selector from a callback: `() => \'foo > bar\'`'
                );
            });
        });
    });

    describe('SelectorAll', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.SelectorAll('foo')));
        });

        describe('#execute()', () => {
            let foo;
            let fooA;
            let fooB;
            let bar;
            let barA;
            let barB;

            beforeEach(() => {
                foo = document.createElement('div');
                fooA = document.createElement('div');
                fooB = document.createElement('div');
                fooA.className = 'foo';
                fooB.className = 'foo';
                foo.appendChild(fooA);
                foo.appendChild(fooB);

                bar = document.createElement('div');
                barA = document.createElement('div');
                barB = document.createElement('div');
                barA.className = 'bar';
                barB.className = 'bar';
                bar.appendChild(barA);
                bar.appendChild(barB);
            });

            it('Should result in a frozen empty array there is no match', () => {
                const action = new actions.SelectorAll('div#nomatch');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 0);
            });

            it('Should result in a frozen array with all matches of the CSS selector', () => {
                const action = new actions.SelectorAll('div.foo');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === fooA);
                ok(result.value[1] === fooB);
            });

            it('Should result in a frozen array with all matches of the CSS selector', () => {
                const action = new actions.SelectorAll('div.foo');
                const result = action.execute([foo, bar]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === fooA);
                ok(result.value[1] === fooB);
            });

            it('Should result in a frozen array with all matches of the CSS selector', () => {
                const action = new actions.SelectorAll('div');
                const result = action.execute([foo, bar]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 4);
                ok(result.value[0] === fooA);
                ok(result.value[1] === fooB);
                ok(result.value[2] === barA);
                ok(result.value[3] === barB);
            });

            it('Should use the CSS selector returned by a callback', () => {
                const action = new actions.SelectorAll(() => 'div.foo');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === fooA);
                ok(result.value[1] === fooB);
            });
        });

        describe('#describe()', () => {
            it('Should describe the selector match', () => {
                eq(
                    new actions.SelectorAll('foo > bar').describe(),
                    'finds all descendant elements matching the CSS selector “foo > bar”'
                );
            });

            it('Should describe a callback', () => {
                eq(
                    new actions.SelectorAll(() => 'foo > bar').describe(),
                    'finds all descendant elements matching a CSS selector from a callback: `() => \'foo > bar\'`'
                );
            });
        });
    });

    describe('XPath', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.XPath('.//foo')));
        });

        describe('#execute()', () => {
            let foo;
            let fooA;
            let fooB;
            let bar;
            let barA;
            let barB;

            beforeEach(() => {
                foo = document.createElement('div');
                fooA = document.createElement('div');
                fooB = document.createElement('div');
                fooA.className = 'foo';
                fooB.className = 'foo';
                fooA.textContent = 'fooA!';
                fooB.textContent = 'fooB!';
                foo.appendChild(fooA);
                foo.appendChild(fooB);

                bar = document.createElement('div');
                barA = document.createElement('div');
                barB = document.createElement('div');
                barA.className = 'bar';
                barB.className = 'bar';
                bar.appendChild(barA);
                bar.appendChild(barB);
            });

            it('Should result in success with a value of null if there is no match', () => {
                const action = new actions.XPath('.//nomatch');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === null);
            });

            it('Should result in the first match of the given XPath', () => {
                const action = new actions.XPath('.//div[@class="foo"]');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === fooA);
            });

            it('Should result in the first match of the given XPath', () => {
                const action = new actions.XPath('.//div');
                const result = action.execute([foo, bar]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === fooA);
            });

            it('Should result in the first match of the given XPath', () => {
                const action = new actions.XPath('.//div[@class="bar"]');
                const result = action.execute([foo, bar]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === barA);
            });

            it('Should use the CSS XPath returned by a callback', () => {
                const action = new actions.XPath(() => './/div[@class="foo"]');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === fooA);
            });

            it('Should result in an error if the result is not an Element or null', () => {
                const action = new actions.XPath('.//div/text()');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_FATAL_FAILURE);
                ok(result.value === null);
                deepEqual(result.reasonStrings, ['a value that is not an Element was returned by the XPath expression']);
                deepEqual(result.reasonValues, []);
            });
        });

        describe('#describe()', () => {
            it('Should describe the selector match', () => {
                eq(
                    new actions.XPath('.//foo/bar').describe(),
                    'finds the first element matching the XPath expression “.//foo/bar”'
                );
            });

            it('Should describe a callback', () => {
                eq(
                    new actions.XPath(() => 'foo > bar').describe(),
                    'finds the first element matching a XPath expression from a callback: `() => \'foo > bar\'`'
                );
            });
        });
    });

    describe('XPathAll', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.XPathAll('.//foo')));
        });

        describe('#execute()', () => {
            let foo;
            let fooA;
            let fooB;
            let bar;
            let barA;
            let barB;

            beforeEach(() => {
                foo = document.createElement('div');
                fooA = document.createElement('div');
                fooB = document.createElement('div');
                fooA.className = 'foo';
                fooB.className = 'foo';
                fooA.textContent = 'fooA';
                fooB.textContent = 'fooB';
                foo.appendChild(fooA);
                foo.appendChild(fooB);

                bar = document.createElement('div');
                barA = document.createElement('div');
                barB = document.createElement('div');
                barA.className = 'bar';
                barB.className = 'bar';
                bar.appendChild(barA);
                bar.appendChild(barB);
            });

            it('Should result in a frozen empty array there is no match', () => {
                const action = new actions.XPathAll('.//nomatch');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 0);
            });

            it('Should result in a frozen array with all matches of the XPath expression', () => {
                const action = new actions.XPathAll('.//div[@class="foo"]');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === fooA);
                ok(result.value[1] === fooB);
            });

            it('Should result in a frozen array with all matches of the XPath expression', () => {
                const action = new actions.XPathAll('.//div[@class="foo"]');
                const result = action.execute([foo, bar]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === fooA);
                ok(result.value[1] === fooB);
            });

            it('Should result in a frozen array with all matches of the XPath expression', () => {
                const action = new actions.XPathAll('.//div');
                const result = action.execute([foo, bar]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 4);
                ok(result.value[0] === fooA);
                ok(result.value[1] === fooB);
                ok(result.value[2] === barA);
                ok(result.value[3] === barB);
            });

            it('Should use the CSS XPath returned by a callback', () => {
                const action = new actions.XPathAll(() => './/div[@class="foo"]');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                ok(Array.isArray(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === fooA);
                ok(result.value[1] === fooB);
            });

            it('Should result in an error if the result is not an Element or null', () => {
                const action = new actions.XPathAll('.//div/text()');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_FATAL_FAILURE);
                ok(result.value === null);
                deepEqual(result.reasonStrings, ['a value that is not an Element was returned by the XPath expression']);
                deepEqual(result.reasonValues, []);
            });
        });

        describe('#describe()', () => {
            it('Should describe the selector match', () => {
                eq(
                    new actions.XPathAll('.//foo/bar').describe(),
                    'finds all elements matching the XPath expression “.//foo/bar”'
                );
            });

            it('Should describe a callback', () => {
                eq(
                    new actions.XPathAll(() => './/foo/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar').describe(),
                    'finds all elements matching a XPath expression from a callback: ' +
                    '`() => \'.//foo/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/bar/b…`'
                );
            });
        });
    });

    describe('readyState', () => {
        let originalReadyStateProp;
        let document1ReadyState;
        let document2ReadyState;
        let document1;
        let document2;

        before(() => {
            document1 = document.implementation.createHTMLDocument('');
            document2 = document.implementation.createHTMLDocument('');

            const documentProto = Object.getPrototypeOf(document);
            originalReadyStateProp = Object.getOwnPropertyDescriptor(documentProto, 'readyState'); // might be undefined

            Object.defineProperty(documentProto, 'readyState', {
                configurable: true,
                get() {
                    if (this === document1) {
                        return document1ReadyState;
                    }

                    if (this === document2) {
                        return document2ReadyState;
                    }

                    return 'complete';
                },
            });
        });

        after(() => {
            const documentProto = Object.getPrototypeOf(document);
            if (originalReadyStateProp) {
                Object.defineProperty(documentProto, 'readyState', originalReadyStateProp);
            }
            else {
                delete documentProto.readyState;
            }
        });

        beforeEach(() => {
            document1ReadyState = 'complete';
            document2ReadyState = 'complete';
        });

        describe('DocumentInteractive', () => {
            it('Should be frozen', () => {
                ok(Object.isFrozen(new actions.DocumentInteractive()));
            });

            describe('#execute()', () => {
                it('Should remain pending if the result item is a document with a readyState of "loading"', () => {
                    document1ReadyState = 'loading';
                    const action = new actions.DocumentInteractive();
                    const result = action.execute(document1);
                    eq(result.status, RESULT_STATUS_PENDING);
                    ok(result.value === null);
                    deepEqual(result.reasonStrings, ['the HTML document has not yet been parsed']);
                    deepEqual(result.reasonValues, []);
                });

                it('Should remain pending if the result item belongs to a document with a readyState of "loading"', () => {
                    document1ReadyState = 'loading';
                    const action = new actions.DocumentInteractive();
                    const result = action.execute(document1.createElement('div'));
                    eq(result.status, RESULT_STATUS_PENDING);
                    ok(result.value === null);
                    deepEqual(result.reasonStrings, ['the HTML document has not yet been parsed']);
                    deepEqual(result.reasonValues, []);
                });

                it('Should remain pending if any of the result items belongs to a document with a readyState of "loading"', () => {
                    document1ReadyState = 'interactive';
                    document2ReadyState = 'loading';
                    const action = new actions.DocumentInteractive();
                    const result = action.execute([document1.createElement('div'), document2.createElement('div')]);
                    eq(result.status, RESULT_STATUS_PENDING);
                    ok(result.value === null);
                    deepEqual(result.reasonStrings, ['the HTML document has not yet been parsed']);
                    deepEqual(result.reasonValues, []);
                });

                it('Should complete successfully if the result item belongs to a document with a readyState of "interactive"', () => {
                    document1ReadyState = 'interactive';
                    const action = new actions.DocumentInteractive();
                    const element1 = document1.createElement('div');
                    const result = action.execute(element1);
                    eq(result.status, RESULT_STATUS_SUCCESS);
                    ok(result.value === element1);
                });

                it('Should complete successfully if the result item belongs to a document with a readyState of "complete"', () => {
                    document1ReadyState = 'complete';
                    const action = new actions.DocumentInteractive();
                    const element1 = document1.createElement('div');
                    const result = action.execute(element1);
                    eq(result.status, RESULT_STATUS_SUCCESS);
                    ok(result.value === element1);
                });

                it('Should complete successfully if none of the result item belongs to a document with a readyState of "loading"', () => {
                    document1ReadyState = 'interactive';
                    document2ReadyState = 'complete';
                    const action = new actions.DocumentInteractive();
                    const element1 = document1.createElement('div');
                    const element2 = document2.createElement('div');
                    const result = action.execute([element1, element2]);
                    eq(result.status, RESULT_STATUS_SUCCESS);
                    ok(Array.isArray(result.value));
                    lengthOf(result.value, 2);
                    ok(result.value[0] === element1);
                    ok(result.value[1] === element2);
                });
            });

            describe('#describe()', () => {
                it('Should describe waiting for the user agent to stop parsing the document, with a timeout', () => {
                    eq(
                        new actions.DocumentInteractive().describe(6500),
                        'waits up to 6.5 seconds until the HTML document has finished parsing'
                    );
                });
            });
        });

        describe('DocumentComplete', () => {
            it('Should be frozen', () => {
                ok(Object.isFrozen(new actions.DocumentComplete()));
            });

            describe('#execute()', () => {
                it('Should remain pending if the result item is a document with a readyState of "interactive"', () => {
                    document1ReadyState = 'interactive';
                    const action = new actions.DocumentComplete();
                    const result = action.execute(document1);
                    eq(result.status, RESULT_STATUS_PENDING);
                    ok(result.value === null);
                    deepEqual(result.reasonStrings, ['the HTML document has not yet been loaded']);
                    deepEqual(result.reasonValues, []);
                });

                it('Should remain pending if the result item is a document with a readyState of "loading"', () => {
                    document1ReadyState = 'loading';
                    const action = new actions.DocumentComplete();
                    const result = action.execute(document1);
                    eq(result.status, RESULT_STATUS_PENDING);
                    ok(result.value === null);
                    deepEqual(result.reasonStrings, ['the HTML document has not yet been parsed']);
                    deepEqual(result.reasonValues, []);
                });

                it('Should remain pending if the result item belongs to a document with a readyState of "interactive"', () => {
                    document1ReadyState = 'interactive';
                    const action = new actions.DocumentComplete();
                    const result = action.execute(document1.createElement('div'));
                    eq(result.status, RESULT_STATUS_PENDING);
                    ok(result.value === null);
                    deepEqual(result.reasonStrings, ['the HTML document has not yet been loaded']);
                    deepEqual(result.reasonValues, []);
                });

                it('Should remain pending if any of the result items belongs to a document with a readyState of "loading"', () => {
                    document1ReadyState = 'complete';
                    document2ReadyState = 'loading';
                    const action = new actions.DocumentComplete();
                    const result = action.execute([document1.createElement('div'), document2.createElement('div')]);
                    eq(result.status, RESULT_STATUS_PENDING);
                    ok(result.value === null);
                    deepEqual(result.reasonStrings, ['the HTML document has not yet been parsed']);
                    deepEqual(result.reasonValues, []);
                });

                it('Should complete successfully if the result item belongs to a document with a readyState of "complete"', () => {
                    document1ReadyState = 'complete';
                    const action = new actions.DocumentComplete();
                    const element1 = document1.createElement('div');
                    const result = action.execute(element1);
                    eq(result.status, RESULT_STATUS_SUCCESS);
                    ok(result.value === element1);
                });

                it('Should complete successfully if all of the result item belongs to a document with a readyState of "complete"', () => {
                    document1ReadyState = 'complete';
                    document2ReadyState = 'complete';
                    const action = new actions.DocumentComplete();
                    const element1 = document1.createElement('div');
                    const element2 = document2.createElement('div');
                    const result = action.execute([element1, element2]);
                    eq(result.status, RESULT_STATUS_SUCCESS);
                    ok(Array.isArray(result.value));
                    lengthOf(result.value, 2);
                    ok(result.value[0] === element1);
                    ok(result.value[1] === element2);
                });
            });

            describe('#describe()', () => {
                it('Should describe waiting for the user agent to fire the window load event, with a timeout', () => {
                    eq(
                        new actions.DocumentComplete().describe(6500),
                        'waits up to 6.5 seconds until all synchronous resources of the HTML document have been loaded'
                    );
                });
            });
        });
    });

    describe('Delay', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.Delay(123)));
        });

        it('Should throw for invalid timeout values', () => {
            throws(() => new actions.Delay('123'), /invalid.*timeout.*argument/i);
            throws(() => new actions.Delay('foo'), /invalid.*timeout.*argument/i);
            throws(() => new actions.Delay({}), /invalid.*timeout.*argument/i);
            throws(() => new actions.Delay(new Date()), /invalid.*timeout.*argument/i);
            throws(() => new actions.Delay(Symbol()), /invalid.*timeout.*argument/i);
        });

        describe('#execute()', () => {
            it('Should be pending if the delay has not yet passed', () => {
                const action = new actions.Delay('2s');
                const result = action.execute(document.body, {executionStart: 5000, checkStart: 5000});
                eq(result.status, RESULT_STATUS_PENDING);
                ok(result.value === null);
                deepEqual(result.reasonStrings, ['the delay of ', ' seconds has not yet elapsed, only ', ' seconds have elapsed so far']);
                deepEqual(result.reasonValues, [2, 0]);
            });

            it('Should be pending if the delay has not yet passed', () => {
                const action = new actions.Delay('2s');
                const result = action.execute(document.body, {executionStart: 5000, checkStart: 6999});
                eq(result.status, RESULT_STATUS_PENDING);
                ok(result.value === null);
                deepEqual(result.reasonStrings, ['the delay of ', ' seconds has not yet elapsed, only ', ' seconds have elapsed so far']);
                deepEqual(result.reasonValues, [2, 1.999]);
            });

            it('Should not modify the currentResult after the delay has passed', () => {
                const action = new actions.Delay(10);
                const result = action.execute([document.body, document.head], {executionStart: 5000, checkStart: 5010});
                eq(result.status, RESULT_STATUS_SUCCESS);
                lengthOf(result.value, 2);
                ok(result.value[0] === document.body);
                ok(result.value[1] === document.head);
            });
        });

        describe('#describe()', () => {
            it('Should describe the delay amount', () => {
                eq(new actions.Delay('1s').describe(), 'waits until 1 seconds have elapsed since the start of the execution');
                eq(new actions.Delay(10).describe(), 'waits until 0.01 seconds have elapsed since the start of the execution');
                eq(new actions.Delay(2000).describe(), 'waits until 2 seconds have elapsed since the start of the execution');
            });
        });
    });

    describe('IsDisplayed', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.IsDisplayed()));
        });

        describe('#execute()', () => {
            const action = new actions.IsDisplayed();
            let elementWithFormattingBox0;
            let elementWithFormattingBox1;
            let elementWithoutFormattingBox0;
            let elementWithoutFormattingBox1;

            beforeEach(() => {
                elementWithFormattingBox0 = document.createElement('div');
                elementWithFormattingBox1 = document.createElement('div');
                elementWithoutFormattingBox0 = document.createElement('div');
                elementWithoutFormattingBox1 = document.createElement('div');

                window.HTMLDivElement.prototype.getBoundingClientRect = function() {
                    if (this === elementWithFormattingBox0 || this === elementWithFormattingBox1) {
                        return Object.freeze({x: 0, y: 0, width: 1, height: 1, top: 0, right: 1, bottom: 1, left: 0});
                    }
                    return Object.freeze({x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0});
                };
            });

            afterEach(() => {
                delete window.HTMLDivElement.prototype.getBoundingClientRect;
            });

            it('Should return null as-is', () => {
                const result = action.execute(null);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === null);
            });

            it('Should return an empty array as-is', () => {
                const result = action.execute([]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                deepEqual(result.value, []);
            });

            it('Should return null if an element is passed without a formatting box', () => {
                const result = action.execute(elementWithoutFormattingBox0);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === null);
            });

            it('Should return an element as-is if it has a formatting box', () => {
                const result = action.execute(elementWithFormattingBox0);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === elementWithFormattingBox0);
            });

            it('Should filter elements without a formatting box if an array is passed', () => {
                const result = action.execute([
                    elementWithFormattingBox0,
                    elementWithFormattingBox1,
                    elementWithoutFormattingBox0,
                    elementWithoutFormattingBox1,
                ]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Array.isArray(result.value));
                ok(Object.isFrozen(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === elementWithFormattingBox0);
                ok(result.value[1] === elementWithFormattingBox1);
            });
        });

        describe('#describe()', () => {
            it('Should describe the filter', () => {
                eq(new actions.IsDisplayed().describe(), 'but only including elements which are displayed on the page');
            });
        });
    });

    describe('Check', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.Check(() => true)));
        });

        it('Should throw for invalid arguments', () => {
            throws(() => new actions.Check(), /check.*callback.*function/i);
            throws(() => new actions.Check(123), /check.*callback.*function/i);
        });

        describe('#execute()', () => {
            it('Should return null as-is', () => {
                const callback = sinon.spy(() => true);
                const result = new actions.Check(() => true).execute(null);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === null);
                eq(callback.callCount, 0);
            });

            it('Should return an empty array as-is', () => {
                const callback = sinon.spy(() => true);
                const result = new actions.Check(() => true).execute([]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                deepEqual(result.value, []);
                eq(callback.callCount, 0);
            });

            it('Should return null if a single element is passed and the callback returns falsy', () => {
                const callback = sinon.spy(() => 0);
                const element = document.createElement('div');
                const result = new actions.Check(callback).execute(element);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === null);
                eq(callback.callCount, 1);
                lengthOf(callback.firstCall.args, 1);
                ok(callback.firstCall.args[0] === element);
            });

            it('Should return an element as-is if a single element is passed and the callback returns truthy', () => {
                const callback = sinon.spy(() => 'truthy');
                const element = document.createElement('div');
                const result = new actions.Check(callback).execute(element);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === element);
                eq(callback.callCount, 1);
                lengthOf(callback.firstCall.args, 1);
                ok(callback.firstCall.args[0] === element);
            });

            it('Should filter elements for which the callback returns falsy', () => {
                const element0 = document.createElement('div');
                const element1 = document.createElement('div');
                const element2 = document.createElement('div');
                const element3 = document.createElement('div');
                const callback = sinon.spy(element => element === element1 || element === element2);

                const result = new actions.Check(callback).execute([
                    element0,
                    element1,
                    element2,
                    element3,
                ]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Array.isArray(result.value));
                ok(Object.isFrozen(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === element1);
                ok(result.value[1] === element2);

                eq(callback.callCount, 4);
                ok(callback.getCall(0).args[0] === element0);
                ok(callback.getCall(1).args[0] === element1);
                ok(callback.getCall(2).args[0] === element2);
                ok(callback.getCall(3).args[0] === element3);
            });
        });

        describe('#describe()', () => {
            it('Should describe the filter', () => {
                eq(
                    new actions.Check(element => element.foo === 123).describe(),
                    'but only including results that match a callback: `element => element.foo === 123`'
                );
            });
        });
    });

    describe('ContainsText', () => {
        it('Should be frozen', () => {
            ok(Object.isFrozen(new actions.ContainsText('foo')));
        });

        it('Should throw for invalid text argument', () => {
            throws(() => new actions.ContainsText(), /containsText.*text.*must.*string.*regexp/i);
            throws(() => new actions.ContainsText(null), /containsText.*text.*must.*string.*regexp/i);
            throws(() => new actions.ContainsText(123), /containsText.*text.*must.*string.*regexp/i);
            throws(() => new actions.ContainsText({}), /containsText.*text.*must.*string.*regexp/i);
            throws(() => new actions.ContainsText(() => {}), /containsText.*text.*must.*string.*regexp/i);
        });

        describe('#execute()', () => {
            let foo;
            let bar;
            let baz;

            beforeEach(() => {
                foo = document.createElement('div');
                bar = document.createElement('div');
                baz = document.createElement('div');
                foo.textContent = 'FOO Foo!';
                bar.textContent = 'BAR Bar!';
                baz.textContent = 'BAZ Baz!';
                bar.appendChild(baz);
            });

            it('Should return null as-is', () => {
                const action = new actions.ContainsText('FOO');
                const result = action.execute(null);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === null);
            });

            it('Should return an empty array as-is', () => {
                const action = new actions.ContainsText('FOO');
                const result = action.execute([]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Object.isFrozen(result.value));
                deepEqual(result.value, []);
            });

            it('Should return null if an element is passed without the given text', () => {
                const action = new actions.ContainsText('hello');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === null);
            });

            it('Should return null if an element is passed for which the textContent does not match the given RegExp', () => {
                const action = new actions.ContainsText(/FO$/);
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === null);
            });

            it('Should return an element as-is if it contains the given text', () => {
                const action = new actions.ContainsText('FOO');
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === foo);
            });

            it('Should return an element as-is if the textContent matches the given RegExp', () => {
                const action = new actions.ContainsText(/FO+/);
                const result = action.execute(foo);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(result.value === foo);
            });

            it('Should filter elements that do not contain the given text', () => {
                const action = new actions.ContainsText(/FO+/);
                const result = action.execute([foo, bar, baz]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Array.isArray(result.value));
                ok(Object.isFrozen(result.value));
                lengthOf(result.value, 1);
                ok(result.value[0] === foo);
            });

            it('Should filter elements that do not contain the given text', () => {
                const action = new actions.ContainsText(/baz!/i);
                const result = action.execute([foo, bar, baz]);
                eq(result.status, RESULT_STATUS_SUCCESS);
                ok(Array.isArray(result.value));
                ok(Object.isFrozen(result.value));
                lengthOf(result.value, 2);
                ok(result.value[0] === bar);
                ok(result.value[1] === baz);
            });
        });

        describe('#describe()', () => {
            it('Should describe the filter', () => {
                eq(
                    new actions.ContainsText('foo').describe(),
                    'but only including results that contain the text: “foo”'
                );

                eq(
                    new actions.ContainsText(/foo/).describe(),
                    'but only including results that contain text matching the regular expression: /foo/'
                );
            });
        });
    });
});
