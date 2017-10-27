'use strict';

const {describe, it, before} = require('mocha-sugar-free');
const {assert: {isNull, isTrue, isBelow, strictEqual: eq, instanceOf, throws, ok}} = require('chai');
const sinon = require('sinon');
const jsdom = require('jsdom');

const {executeSuccess, executePendingTag} = require('../../lib/result');
const Bluefox = require('../..');
const Timer = require('../../lib/Timer');
const Expression = require('../../lib/Expression');
const actions = require('../../lib/actions');
const createMutationObserverMock = require('../createMutationObserverMock');

const USE_JSDOM = !global.window;

describe('Bluefox', () => {
    let window;
    let document;

    before(() => {
        window = USE_JSDOM
            ? (new jsdom.JSDOM()).window
            : global.window;
        document = window.document;

        if (USE_JSDOM && !window.MutationObserver) {
            createMutationObserverMock(window);
        }
    });

    describe('.setTimerFunctions', () => {
        it('Should set the setTimeout and clearTimeout function used to create a Timer', () => {
            try {
                const a = () => {};
                const b = () => {};
                Bluefox.setTimerFunctions(a, b);
                const timer = new Timer();
                eq(timer.setTimeout, a);
                eq(timer.clearTimeout, b);
            }
            finally {
                Bluefox.setTimerFunctions((...args) => setTimeout(...args), (...args) => clearTimeout(...args));
            }
        });
    });

    describe('Creating an expression', () => {
        it('Should create a new expression when one of the chainable methods is called', () => {
            const bluefox = new Bluefox();
            const expression = bluefox.target(null);
            instanceOf(expression, Expression);
            isNull(expression.configuration.previous);
            eq(expression.configuration.timeout, 30000, 'default timeout should be 30s');
            instanceOf(expression.configuration.action, actions.Target);
        });
    });

    describe('#_expressionExecutor', () => {
        it('Should create a new Execution and execute() it', async () => {
            const bluefox = new Bluefox();
            const result = await bluefox.target(null);
            isNull(result);
        });

        it('Should call onExecuteBegin, onCheckBegin, onCheckEnd and onExecuteEnd', async () => {
            const onExecuteBegin = sinon.spy();
            const onCheckBegin = sinon.spy();
            const onCheckEnd = sinon.spy();
            const onExecuteEnd = sinon.spy();
            const bluefox = new Bluefox();
            bluefox.onExecuteBegin = onExecuteBegin;
            bluefox.onCheckBegin = onCheckBegin;
            bluefox.onCheckEnd = onCheckEnd;
            bluefox.onExecuteEnd = onExecuteEnd;

            let actionResult = executePendingTag`foo`;
            const action = new actions.Action();
            action.execute = sinon.spy(() => {
                eq(onExecuteBegin.callCount, 1);
                isTrue(onCheckBegin.called);
                isBelow(onCheckEnd.callCount, onCheckBegin.callCount);
                eq(onExecuteEnd.callCount, 0);
                return actionResult;
            });

            const expression = bluefox.target(document).action(action);

            const executePromise = expression.execute();
            eq(onExecuteBegin.callCount, 1);
            eq(onCheckBegin.callCount, 1);
            eq(onCheckEnd.callCount, 1);
            eq(onExecuteEnd.callCount, 0);

            actionResult = executeSuccess(document.body);
            bluefox.runAllChecks(document);
            eq(onExecuteBegin.callCount, 1);
            eq(onCheckBegin.callCount, 2);
            eq(onCheckEnd.callCount, 2);

            const result = await executePromise;
            eq(onExecuteEnd.callCount, 1);
            eq(result, document.body);

            eq(onExecuteBegin.firstCall.args[0].expression, expression);
            eq(onExecuteEnd.firstCall.args[0].expression, expression);
            eq(onExecuteBegin.firstCall.args[0].executionId, onCheckBegin.firstCall.args[0].executionId);
            eq(onExecuteEnd.firstCall.args[0].executionId, onCheckBegin.firstCall.args[0].executionId);

            eq(await onExecuteBegin.firstCall.args[0].resultPromise, document.body);
            eq(await onExecuteEnd.firstCall.args[0].resultPromise, document.body);
        });
    });

    describe('#_expressionOnceExecutor', () => {
        it('Should create a new Execution and executeOnce() it', async () => {
            const bluefox = new Bluefox();
            const result = bluefox.target(null).executeOnce();
            isNull(result);
        });

        it('Should call onCheckBegin and onCheckEnd only', async () => {
            const onExecuteBegin = sinon.spy();
            const onCheckBegin = sinon.spy();
            const onCheckEnd = sinon.spy();
            const onExecuteEnd = sinon.spy();
            const bluefox = new Bluefox();
            bluefox.onExecuteBegin = onExecuteBegin;
            bluefox.onCheckBegin = onCheckBegin;
            bluefox.onCheckEnd = onCheckEnd;
            bluefox.onExecuteEnd = onExecuteEnd;

            let actionResult = executePendingTag`FOO foo`;
            const action = new actions.Action();
            action.execute = sinon.spy(() => {
                isTrue(onCheckBegin.called);
                isBelow(onCheckEnd.callCount, onCheckBegin.callCount);
                return actionResult;
            });

            throws(() => bluefox.target(document).action(action).executeOnce(), /FOO foo/);
            eq(onCheckBegin.callCount, 1);
            eq(onCheckEnd.callCount, 1);

            actionResult = executeSuccess(document.body);
            const result = bluefox.target(document).action(action).executeOnce();
            ok(result === document.body);
            eq(onCheckBegin.callCount, 2);
            eq(onCheckEnd.callCount, 2);

            eq(onExecuteBegin.callCount, 0);
            eq(onExecuteEnd.callCount, 0);
        });
    });

    describe('#runAllChecks', () => {
        it('Should immediately run all checks for the given document', async () => {
            const bluefox = new Bluefox();
            const action = new actions.Action();
            let actionResult = executePendingTag`foo`;
            action.execute = sinon.spy(() => actionResult);

            const expression = bluefox.target(document).action(action);
            const executePromise = expression.execute();
            eq(action.execute.callCount, 1);

            actionResult = executeSuccess(null);
            bluefox.runAllChecks(document);
            eq(action.execute.callCount, 2);
            await executePromise;
        });
    });

    describe('#runAllChecksDeferred', () => {
        it('Should defer run all checks for the given document', async () => {
            const bluefox = new Bluefox();
            const action = new actions.Action();
            let actionResult = executePendingTag`foo`;
            action.execute = sinon.spy(() => actionResult);

            const expression = bluefox.target(document).action(action);
            const executePromise = expression.execute();
            eq(action.execute.callCount, 1);

            actionResult = executeSuccess(null);
            bluefox.runAllChecksDeferred(document);
            eq(action.execute.callCount, 1, 'should not have immediately run the checks');
            await executePromise;
            eq(action.execute.callCount, 2);
        });
    });
});
