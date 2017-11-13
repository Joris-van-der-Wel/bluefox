'use strict';

const {describe, it, beforeEach, before} = require('mocha-sugar-free');
const {assert: {ok, strictEqual: eq, lengthOf, throws, isTrue, isUndefined, deepEqual, isFunction}} = require('chai');
const jsdom = require('jsdom');
const sinon = require('sinon');

const Expression = require('../../lib/Expression');
const actions = require('../../lib/actions');

const USE_JSDOM = !global.window;

const previous = null;
const executor = () => {};
const onceExecutor = () => {};
const noop = new actions.Noop();
const timeoutMs = 12345;

describe('Expression', () => {
    describe('constructor', () => {
        it('Should check the `previous` argument', () => {
            throws(() => new Expression({previous: 10, action: noop, timeoutMs, executor, onceExecutor}), /invalid.*previous/i);
            throws(() => new Expression({previous: undefined, action: noop, timeoutMs, executor, onceExecutor}), /invalid.*previous/i);
            throws(() => new Expression({previous: {}, action: noop, timeoutMs, executor, onceExecutor}), /invalid.*previous/i);
        });

        it('Should require the `executor` argument if `previous` is not set', () => {
            throws(() => new Expression({previous, action: noop, timeoutMs, onceExecutor}), /executor.*must.*root/i);
        });

        it('Should require the `onceExecutor` argument if `previous` is not set', () => {
            throws(() => new Expression({previous, action: noop, timeoutMs, executor}), /onceExecutor.*must.*root/i);
        });

        it('Should not allow `executor` argument to be set if `previous` is set', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            throws(() => new Expression({previous: root, action: noop, timeoutMs, executor, onceExecutor}), /executor.*only.*root/i);
        });

        it('Should check the `action` argument', () => {
            throws(() => new Expression({previous, action: undefined, timeoutMs, executor, onceExecutor}), /invalid.*action/i);
            throws(() => new Expression({previous, action: null, timeoutMs, executor, onceExecutor}), /invalid.*action/i);
            throws(() => new Expression({previous, action: 123, timeoutMs, executor, onceExecutor}), /invalid.*action/i);
            throws(() => new Expression({previous, action: {}, timeoutMs, executor, onceExecutor}), /invalid.*action/i);
            throws(
                () => new Expression({previous, action: {execute: 123, describe: 123}, timeoutMs, executor, onceExecutor}),
                /invalid.*action/i
            );
        });

        it('Should check the `timeoutMs` argument', () => {
            throws(() => new Expression({previous, action: noop, timeoutMs: undefined, executor, onceExecutor}), /invalid.*timeoutMs/i);
            throws(() => new Expression({previous, action: noop, timeoutMs: null, executor, onceExecutor}), /invalid.*timeoutMs/i);
            throws(() => new Expression({previous, action: noop, timeoutMs: '123', executor, onceExecutor}), /invalid.*timeoutMs/i);
            throws(() => new Expression({previous, action: noop, timeoutMs: {}, executor, onceExecutor}), /invalid.*timeoutMs/i);
        });
    });

    describe('#getExpressionChain()', () => {
        it('Should return an array containing only itself if called on the root expression', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            const items = root.getExpressionChain();
            lengthOf(items, 1);
            eq(items[0], root);
        });

        it('Should not be affected by descendant expressions', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            root.target(null).selector('foo');
            const items = root.getExpressionChain();
            lengthOf(items, 1);
            eq(items[0], root);
        });

        it('Should return all inclusive ancestors, sorted by depth', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            const target = root.target(null);
            const documentComplete = target.documentComplete();
            const items = documentComplete.getExpressionChain();
            lengthOf(items, 3);
            eq(items[0], root);
            eq(items[1], target);
            eq(items[2], documentComplete);
        });

        it('Should add an implicit default Amount action if a previous action requires it', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            const target = root.target(null);
            const selector = target.selector('foo');
            const items = selector.getExpressionChain();

            lengthOf(items, 4);
            eq(items[0], root);
            eq(items[1], target);
            eq(items[2], selector);
            eq(items[3].configuration.action, actions.DEFAULT_AMOUNT_ACTION);
        });
    });

    describe('#execute()', () => {
        it('Should call the executor passed in the constructor', async () => {
            const executor = sinon.spy();
            const onceExecutor = sinon.spy();
            const root = new Expression({
                previous,
                action: noop,
                timeoutMs,
                executor: async expression => executor(expression),
                onceExecutor,
            });
            const executePromise = root.execute();
            await executePromise;
            await executePromise; // second time should have no side effects
            isTrue(executor.calledOnce);
            eq(executor.firstCall.args[0], root);
            isTrue(onceExecutor.notCalled);
        });
    });

    describe('#executeOnce()', () => {
        it('Should call the onceExecutor passed in the constructor', async () => {
            const executor = sinon.spy();
            const expectedResult = {foo: 123};
            const onceExecutor = sinon.spy(() => expectedResult);
            const root = new Expression({
                previous,
                action: noop,
                timeoutMs,
                executor: async expression => executor(expression),
                onceExecutor,
            });
            const result = root.executeOnce();

            isTrue(executor.notCalled);
            isTrue(onceExecutor.calledOnce);
            eq(onceExecutor.firstCall.args[0], root);
            eq(result, expectedResult);
        });
    });

    describe('#then()', () => {
        it('Should execute the expression and call .then() on the promise', async () => {
            const executor = sinon.spy();
            const root = new Expression({
                previous,
                action: noop,
                timeoutMs,
                executor: async expression => executor(expression),
                onceExecutor,
            });
            const foo = await root.then(() => 123);
            eq(foo, 123);
            isTrue(executor.calledOnce);
            eq(executor.firstCall.args[0], root);

            const bar = await root.then(() => 456);
            eq(bar, 456);
            isTrue(executor.calledTwice);
            eq(executor.secondCall.args[0], root);
        });

        it('Should handle rejections', async () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor: () => Promise.reject(456), onceExecutor});
            const foo = await root.then(() => 123, err => err + 1);
            eq(foo, 457);
        });

        it('Should be awaitable', async () => {
            const executor = sinon.spy();
            const root = new Expression({
                previous,
                action: noop,
                timeoutMs,
                executor: async expression => executor(expression),
                onceExecutor,
            });
            await root;
            isTrue(executor.calledOnce);
            eq(executor.firstCall.args[0], root);
        });
    });

    describe('#catch()', async () => {
        it('Should execute the expression and call .catch() on the promise', async () => {
            const executor = sinon.spy(() => {
                throw 456; // eslint-disable-line no-throw-literal
            });
            const root = new Expression({
                previous,
                action: noop,
                timeoutMs,
                executor: async expression => executor(expression),
                onceExecutor,
            });
            const foo = await root.catch(err => err + 1);
            eq(foo, 457);
            isTrue(executor.calledOnce);
            eq(executor.firstCall.args[0], root);

            const bar = await root.catch(err => err + 2);
            eq(bar, 458);
            isTrue(executor.calledTwice);
            eq(executor.secondCall.args[0], root);
        });
    });

    describe('#finally()', async () => {
        it('Should execute the expression and call .finally() on the promise', async () => {
            const executor = sinon.spy();
            const root = new Expression({
                previous,
                action: noop,
                timeoutMs,
                executor: async expression => executor(expression),
                onceExecutor,
            });
            const handleFinally = sinon.spy(() => 123);
            const foo = await root.finally(handleFinally);
            isUndefined(foo);
            isTrue(executor.calledOnce);
            eq(executor.firstCall.args[0], root);
            isTrue(handleFinally.calledOnce);

            const handleFinally2 = sinon.spy(() => 123);
            const bar = await root.finally(handleFinally2);
            isUndefined(bar);
            isTrue(executor.calledTwice);
            eq(executor.secondCall.args[0], root);
            isTrue(handleFinally.calledOnce);
            isTrue(handleFinally2.calledOnce);
        });

        it('Should handle rejections', async () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor: () => Promise.reject(456), onceExecutor});
            const handleFinally = sinon.spy(() => 123);
            const foo = await root.finally(handleFinally).catch(error => error + 1);
            eq(foo, 457);
            isTrue(handleFinally.calledOnce);
        });
    });

    describe('#notThenable', () => {
        it('Should create an expression which is not automagically consumed by promise handlers', async () => {
            const executor = sinon.spy();
            const root = new Expression({
                previous,
                action: noop,
                timeoutMs,
                executor: async expression => executor(expression),
                onceExecutor,
            });
            const expression = root.notThenable();
            isUndefined(expression.then);
            isUndefined(expression.catch);
            isUndefined(expression.finally);

            eq(await expression, expression);
            await Promise.resolve().then(() => expression).then(result => eq(result, expression));
        });

        it('Should not affect child expressions', () => {
            const executor = sinon.spy();
            const root = new Expression({
                previous,
                action: noop,
                timeoutMs,
                executor: async expression => executor(expression),
                onceExecutor,
            });
            const expression = root.notThenable().timeout('5s');
            isFunction(expression.then);
            isFunction(expression.catch);
            isFunction(expression.finally);
        });
    });

    describe('#describe()', () => {
        let root;
        let window;
        let document;

        before(() => {
            window = USE_JSDOM
                ? (new jsdom.JSDOM()).window
                : global.window;
            document = window.document;
        });

        beforeEach(() => {
            root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
        });

        it('Should describe all actions in the chain', () => {
            const expression = root.target(window).timeout('4s').selectorAll('foo > bar').amount(1, 4);
            eq(
                expression.describe(),
                'The expression sets the target to <#window>, finds all descendant elements matching the CSS selector “foo > bar”, ' +
                'waits up to 4 seconds until between 1 and 4 (inclusive) results are found.'
            );
        });

        it('Should describe the default timeout', () => {
            const expression = root.target(window).selectorAll('foo > bar').amount(1, 4);
            eq(
                expression.describe(),
                'The expression sets the target to <#window>, finds all descendant elements matching the CSS selector “foo > bar”, ' +
                'waits up to 12.345 seconds until between 1 and 4 (inclusive) results are found.'
            );
        });

        it('Should not include descendant expressions in the description', () => {
            const expression = root.target(document.createElement('section'));
            expression.selector('foo'); // should have no effect on the output

            eq(
                expression.describe(),
                'The expression sets the target to <section>.'
            );
        });

        it('Should have a description for all the actions', () => {
            eq(
                root
                .timeout('4.5s')
                .target(document)
                .documentInteractive()
                .delay('3s')
                .action(new actions.DocumentInteractive())
                .selectorAll('div.gallery-item')
                .amount(1, Infinity)
                .selector('.title')
                .containsText('Hello!')
                .check(element => element.scrollTop > 0)
                .documentComplete()
                .xpath('./../section')
                .overrideStartTime(1234)
                .timeout('10s')
                .xpathAll('.//img')
                .isDisplayed()
                .amount(2, 10)
                .describe(),
                'The expression sets the target to <#document>, waits up to 4.5 seconds until the HTML document has finished parsing, ' +
                'waits until 3 seconds have elapsed since the start of the execution, waits up to 4.5 seconds until the HTML document ' +
                'has finished parsing, finds all descendant elements matching the CSS selector “div.gallery-item”, waits up to 4.5 sec' +
                'onds until a result is found, finds the first descendant element matching the CSS selector “.title”, but only includi' +
                'ng results that contain the text: “Hello!”, but only including results that match a callback: `element => element.scr' +
                'ollTop > 0`, waits up to 4.5 seconds until all synchronous resources of the HTML document have been loaded, finds the' +
                ' first element matching the XPath expression “./../section”, finds all elements matching the XPath expression “.//img' +
                '”, but only including elements which are displayed on the page, waits up to 10 seconds until between 2 and 10 (inclus' +
                'ive) results are found.'
            );
        });

        it('Should describe the default amount', () => {
            eq(
                root
                .timeout('4.5s')
                .target(document)
                .selectorAll('div.gallery-item')
                .describe(),
                'The expression sets the target to <#document>, finds all descendant elements matching the CSS selector “div.gallery-i' +
                'tem”, waits up to 4.5 seconds until a result is found.'
            );
        });
    });

    describe('#configuration.additionalCheckTimeout', () => {
        it('Should add the timeout to the array', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            deepEqual(root.configuration.additionalCheckTimeout, [12345]);
        });

        it('Should be frozen', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            ok(Object.isFrozen(root.configuration.additionalCheckTimeout));
        });

        it('Should add action.additionalCheckTimeout to the array', () => {
            const action = {
                execute: () => {},
                describe: () => {},
                additionalCheckTimeout: [678, 901],
            };
            const root = new Expression({previous, action, timeoutMs, executor, onceExecutor});
            deepEqual(root.configuration.additionalCheckTimeout, [12345, 678, 901]);
        });
    });

    describe('#overrideStartTime', () => {
        it('Should create an expression with overrideStartTime set', () => {
            const executor = sinon.spy();
            const root = new Expression({
                previous,
                action: noop,
                timeoutMs,
                executor: async expression => executor(expression),
                onceExecutor,
            });

            eq(root.configuration.overrideStartTime, undefined);
            eq(root.overrideStartTime(123456).configuration.overrideStartTime, 123456);
            eq(root.overrideStartTime(null).configuration.overrideStartTime, null);
            throws(() => root.overrideStartTime('foo'), /unixTimeMs.*must.*number/i);
            throws(() => root.overrideStartTime(NaN), /unixTimeMs.*must.*finite.*number/i);
        });
    });

    describe('#selector()', () => {
        it('Should pass a single string as-is', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            const selector = root.selector('foo > bar');
            const action = selector.configuration.action;
            eq(action.expression, 'foo > bar');
        });

        it('Should pass a single function as-is', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            const callback = 'foo > bar';
            const selector = root.selector(callback);
            const action = selector.configuration.action;
            eq(action.expression, callback);
        });

        it('Should perform escaping when called as a tagged template literal', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            const selector = root.selector`foo > #${'123#bla'}`;
            const action = selector.configuration.action;
            eq(action.expression, 'foo > #\\31 23\\#bla');
        });
    });

    describe('#selectorAll()', () => {
        it('Should pass a single string as-is', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            const selector = root.selectorAll('foo > bar');
            const action = selector.configuration.action;
            eq(action.expression, 'foo > bar');
        });

        it('Should pass a single function as-is', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            const callback = 'foo > bar';
            const selector = root.selectorAll(callback);
            const action = selector.configuration.action;
            eq(action.expression, callback);
        });

        it('Should perform escaping when called as a tagged template literal', () => {
            const root = new Expression({previous, action: noop, timeoutMs, executor, onceExecutor});
            const selector = root.selectorAll`foo > #${'123#bla'}`;
            const action = selector.configuration.action;
            eq(action.expression, 'foo > #\\31 23\\#bla');
        });
    });
});
