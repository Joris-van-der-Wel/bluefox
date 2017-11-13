'use strict';

const {describe, it, before, after, beforeEach} = require('mocha-sugar-free');
const {assert: {isFalse, isTrue, ok, throws, match, strictEqual: eq, isBelow, lengthOf}} = require('chai');
const sinon = require('sinon');
const jsdom = require('jsdom');

const {executeSuccess, executePendingTag, executeFatalFailureTag} = require('../../lib/result');
const Execution = require('../../lib/Execution');
const Expression = require('../../lib/Expression');
const actions = require('../../lib/actions');

const USE_JSDOM = !global.window;

describe('Execution', () => {
    const createActionMock = result => {
        return {
            execute: sinon.spy(result),
        };
    };
    const createExpressionMock = (action, ancestors = [], {timeout = 10000, overrideStartTime = undefined} = {}) => {
        const expression = Object.freeze({
            getExpressionChain: sinon.spy(() => [...ancestors, expression]),
            configuration: Object.freeze({
                timeout,
                action,
                additionalCheckTimeout: Object.freeze([timeout]),
                overrideStartTime,
            }),
            describe: sinon.spy(() => 'Expression Mock Describe'),
        });
        return expression;
    };

    let window;
    let document;

    before(() => {
        window = USE_JSDOM
            ? (new jsdom.JSDOM()).window
            : global.window;
        document = window.document;
    });

    let documentObservers;
    let createTimerMock;

    beforeEach(() => {
        documentObservers = {
            registerExecution: sinon.spy(),
            unregisterExecution: sinon.spy(),
        };
        createTimerMock = sinon.spy(() => ({
            schedule: sinon.spy(),
            cancel: sinon.spy(),
        }));
    });

    describe('#firstCheck()', () => {
        it('Should not allow firstCheck() to be called multiple times', async () => {
            const h1 = document.createElement('h1');
            const action = createActionMock(() => executeSuccess(h1));
            const expression = createExpressionMock(action);
            const execution = new Execution(expression, documentObservers, 12345);

            execution.firstCheck();
            isTrue(action.execute.calledOnce, 'should immediately call all actions');

            throws(() => execution.firstCheck(), /invalid.*state/i);
            isTrue(action.execute.calledOnce);
        });
    });

    describe('#execute()', () => {
        it('Should immediately trigger a check', async () => {
            const h1 = document.createElement('h1');
            const action0 = createActionMock(() => executeSuccess(h1));
            const action1 = createActionMock(() => executeSuccess(h1));
            const expression0 = createExpressionMock(action0);
            const expression1 = createExpressionMock(action1, [expression0]);
            const execution = new Execution(expression1, documentObservers, 12345);

            const executePromise = execution.execute();
            isTrue(action0.execute.calledOnce, 'should immediately call all actions');
            isTrue(action1.execute.calledOnce, 'should immediately call all actions');
            isTrue(execution.fulfilled);

            const executeResult = await executePromise;
            isTrue(action0.execute.calledOnce);
            isTrue(action1.execute.calledOnce);
            ok(executeResult === h1);
        });

        it('Should not trigger extra checks upon multiple invocations', async () => {
            const h1 = document.createElement('h1');
            const action = createActionMock(() => executeSuccess(h1));
            const expression = createExpressionMock(action);
            const execution = new Execution(expression, documentObservers, 12345);

            const executePromise = execution.execute();
            isTrue(action.execute.calledOnce);
            isTrue(execution.fulfilled);

            const executeResult = await executePromise;
            isTrue(action.execute.calledOnce);
            ok(executeResult === h1);

            ok((await execution.execute()) === h1);
            ok((await execution.execute()) === h1);
            isTrue(action.execute.calledOnce);
        });

        it('Should register the HTMLDocument of result items with a DocumentObserver', async () => {
            // documents without a browsing context are normally not supported, however we mock away DocumentObservers
            const document2 = document.implementation.createHTMLDocument('');
            const document3 = document.implementation.createHTMLDocument('');
            const document4 = document.implementation.createHTMLDocument('');
            const documentMatch = sinon.match.same(document);
            const document2Match = sinon.match.same(document2);
            const document3Match = sinon.match.same(document3);
            const document4Match = sinon.match.same(document4);
            const h1 = document.createElement('h1');
            const h2 = document2.createElement('h2');
            const h3 = document3.createElement('h3');
            const h4 = document4.createElement('h4');
            const action0Result = executeSuccess(h1);
            let action1Result = executeSuccess([h2, h3]);
            let action2Result = executePendingTag`foo`;
            const action0 = createActionMock(() => action0Result);
            const action1 = createActionMock(() => action1Result);
            const action2 = createActionMock(() => action2Result);
            const expression0 = createExpressionMock(action0);
            const expression1 = createExpressionMock(action1, [expression0]);
            const expression2 = createExpressionMock(action2, [expression0, expression1]);
            const execution = new Execution(expression2, documentObservers, 12345);
            const executionMatch = sinon.match.same(execution);

            const {registerExecution, unregisterExecution} = documentObservers;
            isTrue(registerExecution.notCalled);
            const executePromise = execution.execute();
            isTrue(registerExecution.calledWithExactly(documentMatch, executionMatch), 'expected to register document 1');
            isTrue(registerExecution.calledWithExactly(document2Match, executionMatch), 'expected to register document 2');
            isTrue(registerExecution.calledWithExactly(document3Match, executionMatch), 'expected to register document 3');
            isFalse(registerExecution.calledWithExactly(document4Match, executionMatch), 'expected NOT to register document 4');
            isTrue(unregisterExecution.notCalled);

            // document3 is no longer encountered, but document4 is new
            action1Result = executeSuccess([h2, h4]);
            execution.check();
            isTrue(unregisterExecution.getCall(0).calledWithExactly(document3Match, executionMatch), 'expected to unregister document 3');
            eq(unregisterExecution.callCount, 1);
            isTrue(registerExecution.calledWithExactly(document4, executionMatch), 'expected to register document 4');

            // cleanup:
            action2Result = executeSuccess([h1, h2, h3, h4]);
            execution.check();
            isTrue(execution.fulfilled);
            isTrue(unregisterExecution.getCall(1).calledWithExactly(documentMatch, executionMatch), 'expected to unregister document 1');
            isTrue(unregisterExecution.getCall(2).calledWithExactly(document2Match, executionMatch), 'expected to unregister document 2');
            isTrue(unregisterExecution.getCall(3).calledWithExactly(document4Match, executionMatch), 'expected to unregister document 4');
            eq(unregisterExecution.callCount, 4);

            await executePromise;
        });

        it('Should unregister all HTMLDocument when the execution errors', async () => {
            const document2 = document.implementation.createHTMLDocument('');
            const documentMatch = sinon.match.same(document);
            const document2Match = sinon.match.same(document2);
            const h1 = document.createElement('h1');
            const h2 = document2.createElement('h2');
            let action1Result = () => executePendingTag`foo`;
            const action0 = createActionMock(() => executeSuccess([h1, h2]));
            const action1 = createActionMock(() => action1Result());
            const expression0 = createExpressionMock(action0);
            const expression1 = createExpressionMock(action1, [expression0]);
            const execution = new Execution(expression1, documentObservers, 12345);
            const executionMatch = sinon.match.same(execution);

            const {registerExecution, unregisterExecution} = documentObservers;
            const executePromise = execution.execute();
            isTrue(registerExecution.calledWithExactly(documentMatch, executionMatch), 'expected to register document 1');
            isTrue(registerExecution.calledWithExactly(document2Match, executionMatch), 'expected to register document 2');

            action1Result = () => { throw Error('foo123'); };
            execution.check();
            isTrue(execution.fulfilled);
            isTrue(unregisterExecution.getCall(0).calledWithExactly(documentMatch, executionMatch), 'expected to unregister document 1');
            isTrue(unregisterExecution.getCall(1).calledWithExactly(document2Match, executionMatch), 'expected to unregister document 2');
            await executePromise.catch(err => match(err.message, /foo123/));
        });

        it('Should perform extra checks at all the different timeout moments and reject the execution', async () => {
            const h1 = document.createElement('h1');
            const action0 = createActionMock(() => executeSuccess(h1));
            const action1 = createActionMock(() => executeSuccess(h1));
            const action2 = createActionMock(() => executePendingTag`action mock ${1 + 2 - 1} is pending`);
            const action3 = createActionMock(() => executeSuccess(h1));

            const expression0 = createExpressionMock(action0, [], {timeout: 1234});
            const expression1 = createExpressionMock(action1, [expression0], {timeout: 1234});
            const expression2 = createExpressionMock(action2, [expression0, expression1], {timeout: 3214});
            const expression3 = createExpressionMock(action3, [expression0, expression1, expression2], {timeout: 1234});
            const execution = new Execution(expression3, documentObservers, 12345);
            execution.createTimer = createTimerMock;
            let now = 40000;
            execution.now = () => now;

            let executeError;
            const executePromise = execution.execute().catch(error => {executeError = error;});
            isFalse(execution.fulfilled);
            isTrue(action0.execute.calledOnce); // immediate first check
            isTrue(action1.execute.calledOnce);
            isTrue(action2.execute.calledOnce);
            isTrue(action3.execute.notCalled);

            // we are executing 3 actions, however we only use 2 unique timeouts
            isTrue(createTimerMock.calledTwice);
            eq(createTimerMock.firstCall.args[0], 1234);
            eq(createTimerMock.secondCall.args[0], 3214);
            const firstTimer = createTimerMock.firstCall.returnValue;
            const secondTimer = createTimerMock.firstCall.returnValue;
            isTrue(firstTimer.schedule.calledOnce);
            isTrue(secondTimer.schedule.calledOnce);
            isTrue(firstTimer.cancel.notCalled);
            isTrue(secondTimer.cancel.notCalled);

            now = 40000 + 1234;
            createTimerMock.firstCall.args[1](); // invoke the first timer
            isTrue(action0.execute.calledTwice);
            isTrue(action1.execute.calledTwice);
            isTrue(action2.execute.calledTwice);
            isTrue(action3.execute.notCalled);
            isFalse(execution.fulfilled);

            now = 40000 + 3214;
            createTimerMock.secondCall.args[1](); // invoke the second timer
            isTrue(action0.execute.calledThrice);
            isTrue(action1.execute.calledThrice);
            isTrue(action2.execute.calledThrice);
            isTrue(action3.execute.notCalled);
            isTrue(execution.fulfilled);

            await executePromise;
            ok(executeError);
            eq(
                executeError.message,
                'Wait expression timed out after 3.214 seconds because action mock 2 is pending. Expression Mock Describe'
            );
            eq(executeError.name, 'BluefoxTimeoutError');
            eq(executeError.timeout, 3214);
            eq(executeError.actionFailure, 'action mock 2 is pending');
            eq(executeError.expression, expression2);
            eq(executeError.fullExpression, expression3);
        });

        it('Should trigger the timeout at the proper time if overrideStartTime is set to a number', async () => {
            const h1 = document.createElement('h1');
            const action0 = createActionMock(() => executePendingTag`action mock ${1 + 2 - 2} is pending`);
            const action1 = createActionMock(() => executeSuccess(h1));

            const expression0 = createExpressionMock(action0, [], {timeout: 1234, overrideStartTime: 20000});
            // if overrideStartTime is undefined, do not overwrite the previous value (20000)
            const expression1 = createExpressionMock(action1, [expression0], {timeout: 1234, overrideStartTime: undefined});
            const execution = new Execution(expression1, documentObservers, 12345);
            execution.createTimer = createTimerMock;
            let now = 20500;
            execution.now = () => now;

            let executeError;
            const executePromise = execution.execute().catch(error => {executeError = error;});
            isFalse(execution.fulfilled);
            eq(action0.execute.callCount, 1); // immediate first check
            eq(action1.execute.callCount, 0);
            isTrue(createTimerMock.calledOnce);

            // we are now timed out according to overrideStartTime, but not according to now() at the time of the first execution
            now = 20000 + 1234;
            createTimerMock.firstCall.args[1](); // invoke the first timer
            isTrue(execution.fulfilled);

            await executePromise;
            ok(executeError);
            eq(
                executeError.message,
                'Wait expression timed out after 1.234 seconds because action mock 1 is pending. Expression Mock Describe'
            );
            eq(executeError.name, 'BluefoxTimeoutError');
            eq(executeError.timeout, 1234);
            eq(executeError.actionFailure, 'action mock 1 is pending');
            eq(executeError.expression, expression0);
            eq(executeError.fullExpression, expression1);
        });

        it('Should trigger the timeout at the proper time if overrideStartTime is set to null', async () => {
            const h1 = document.createElement('h1');
            const action0 = createActionMock(() => executePendingTag`action mock ${1 + 2 - 2} is pending`);
            const action1 = createActionMock(() => executeSuccess(h1));

            const expression0 = createExpressionMock(action0, [], {timeout: 1234, overrideStartTime: 20000});
            // if overrideStartTime is undefined, do not overwrite the previous value (20000)
            const expression1 = createExpressionMock(action1, [expression0], {timeout: 1234, overrideStartTime: null});
            const execution = new Execution(expression1, documentObservers, 12345);
            execution.createTimer = createTimerMock;
            let now = 20500;
            execution.now = () => now;

            let executeError;
            const executePromise = execution.execute().catch(error => {executeError = error;});
            isFalse(execution.fulfilled);
            eq(action0.execute.callCount, 1); // immediate first check
            eq(action1.execute.callCount, 0);
            isTrue(createTimerMock.calledOnce);

            // we are now timed out according to overrideStartTime, but not according to now() at the time of the first execution
            now = 20500 + 1234 - 1;
            createTimerMock.firstCall.args[1](); // invoke the first timer
            isFalse(execution.fulfilled);

            // we are now timed out according according to now() at the time of the first execution
            now = 20500 + 1234;
            createTimerMock.firstCall.args[1](); // invoke the first timer
            isTrue(execution.fulfilled);

            await executePromise;
            ok(executeError);
            eq(
                executeError.message,
                'Wait expression timed out after 1.234 seconds because action mock 1 is pending. Expression Mock Describe'
            );
            eq(executeError.name, 'BluefoxTimeoutError');
            eq(executeError.timeout, 1234);
            eq(executeError.actionFailure, 'action mock 1 is pending');
            eq(executeError.expression, expression0);
            eq(executeError.fullExpression, expression1);
        });

        it('Should pass metaData about the time at execution and check start', () => {
            const h1 = document.createElement('h1');
            const action0 = createActionMock(() => executeSuccess(h1));
            const action1 = createActionMock(() => executePendingTag`action mock is pending`);
            const expression0 = createExpressionMock(action0, [], {timeout: 1234});
            const expression1 = createExpressionMock(action1, [expression0], {timeout: 1234});

            const execution = new Execution(expression1, documentObservers, 12345);
            execution.createTimer = createTimerMock;
            let now = 40000;
            execution.now = () => now;

            execution.execute().catch(() => {});

            now += 1000;
            execution.check();

            now += 1500;
            execution.check();

            isTrue(action0.execute.calledThrice);
            isTrue(action1.execute.calledThrice);
            eq(action0.execute.firstCall.args[1].executionStart, 40000);
            eq(action0.execute.firstCall.args[1].checkStart, 40000);
            eq(action1.execute.firstCall.args[1].executionStart, 40000);
            eq(action1.execute.firstCall.args[1].checkStart, 40000);

            eq(action0.execute.secondCall.args[1].executionStart, 40000);
            eq(action0.execute.secondCall.args[1].checkStart, 41000);
            eq(action1.execute.secondCall.args[1].executionStart, 40000);
            eq(action1.execute.secondCall.args[1].checkStart, 41000);

            eq(action0.execute.thirdCall.args[1].executionStart, 40000);
            eq(action0.execute.thirdCall.args[1].checkStart, 42500);
            eq(action1.execute.thirdCall.args[1].executionStart, 40000);
            eq(action1.execute.thirdCall.args[1].checkStart, 42500);
        });

        describe('Timeout failure message', () => {
            let originalReadyStateProp;
            let documentReadyState;
            let root;
            let now;
            let h1;

            const createExecution = expression => {
                const execution = new Execution(expression, documentObservers, 12345);
                execution.createTimer = createTimerMock;
                execution.now = () => now;
                return execution;
            };

            const executeAndTimeout = async (expression, time) => {
                const execution = createExecution(expression);
                let executeError;
                const executePromise = execution.execute().catch(error => {executeError = error;});
                now += time;
                execution.check();
                await executePromise;
                return executeError;
            };

            before(() => {
                documentReadyState = 'complete';
                const documentProto = Object.getPrototypeOf(document);
                originalReadyStateProp = Object.getOwnPropertyDescriptor(documentProto, 'readyState'); // might be undefined
                Object.defineProperty(documentProto, 'readyState', {
                    configurable: true,
                    get() {
                        return documentReadyState;
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
                h1 = document.createElement('h1');
                root = new Expression({
                    previous: null,
                    action: new actions.Noop(),
                    timeoutMs: 12345,
                    executor: () => {},
                    onceExecutor: () => {},
                });
                now = 40000;
            });

            it('should describe no results were found', async () => {
                const expression = root.target(h1).selector('#foo').amount(1, 2).selector('.another-selector');
                const error = await executeAndTimeout(expression, 12345);
                eq(
                    error.message,
                    'Wait expression timed out after 12.345 seconds because no results were found, instead of a minimum of 1 results. The' +
                    ' expression sets the target to <h1>, finds the first descendant element matching the CSS selector “#foo”, waits up t' +
                    'o 12.345 seconds until between 1 and 2 (inclusive) results are found.'
                );
            });

            it('should describe not enough results were found', async () => {
                h1.appendChild(document.createElement('span'));
                const expression = root.target(h1).selectorAll('span').amount(2, 10).selector('.another-selector');
                const error = await executeAndTimeout(expression, 12345);
                eq(
                    error.message,
                    'Wait expression timed out after 12.345 seconds because only 1 results were found, instead of a minimum of 2 results.' +
                    ' The expression sets the target to <h1>, finds all descendant elements matching the CSS selector “span”, waits up to' +
                    ' 12.345 seconds until between 2 and 10 (inclusive) results are found.'
                );
            });

            it('should describe too many results were found', async () => {
                h1.appendChild(document.createElement('span'));
                h1.appendChild(document.createElement('span'));
                h1.appendChild(document.createElement('span'));
                const expression = root.target(h1).selectorAll('span').amount(0, 2).selector('.another-selector');
                const error = await executeAndTimeout(expression, 12345);
                eq(
                    error.message,
                    'Wait expression timed out after 12.345 seconds because 3 results were found, instead of a maximum of 2 results. The ' +
                    'expression sets the target to <h1>, finds all descendant elements matching the CSS selector “span”, waits up to 12.3' +
                    '45 seconds until between 0 and 2 (inclusive) results are found.'
                );
            });

            it('should describe the html document has not yet been parsed (documentInteractive())', async () => {
                documentReadyState = 'loading';
                const expression = root.target(document).documentInteractive();
                const error = await executeAndTimeout(expression, 12345);
                eq(
                    error.message,
                    'Wait expression timed out after 12.345 seconds because the HTML document has not yet been parsed. The expression set' +
                    's the target to <#document>, waits up to 12.345 seconds until the HTML document has finished parsing.'
                );
            });

            it('should describe the html document has not yet been parsed (documentComplete())', async () => {
                documentReadyState = 'loading';
                const expression = root.target(document).documentComplete();
                const error = await executeAndTimeout(expression, 12345);
                eq(
                    error.message,
                    'Wait expression timed out after 12.345 seconds because the HTML document has not yet been parsed. The expression set' +
                    's the target to <#document>, waits up to 12.345 seconds until all synchronous resources of the HTML document have be' +
                    'en loaded.'
                );
            });

            it('should describe the html document has not yet been loaded', async () => {
                documentReadyState = 'interactive';
                const expression = root.target(document).documentComplete();
                const error = await executeAndTimeout(expression, 12345);
                eq(
                    error.message,
                    'Wait expression timed out after 12.345 seconds because the HTML document has not yet been loaded. The expression set' +
                    's the target to <#document>, waits up to 12.345 seconds until all synchronous resources of the HTML document have be' +
                    'en loaded.'
                );
            });
        });

        it('Should resolve with null from executeSuccess', async () => {
            const action = createActionMock(() => executeSuccess(null));
            const expression = createExpressionMock(action);
            const execution = new Execution(expression, documentObservers, 12345);

            const result = await execution.execute();
            eq(result, null);
        });

        it('Should resolve with a singular node from executeSuccess', async () => {
            const h1 = document.createElement('h1');
            const action = createActionMock(() => executeSuccess(h1));
            const expression = createExpressionMock(action);
            const execution = new Execution(expression, documentObservers, 12345);

            const result = await execution.execute();
            eq(result, h1);
        });

        it('Should resolve with an array of nodes from executeSuccess', async () => {
            const h1 = document.createElement('h1');
            const h2 = document.createElement('h2');
            const action = createActionMock(() => executeSuccess([h1, h2]));
            const expression = createExpressionMock(action);
            const execution = new Execution(expression, documentObservers, 12345);

            const result = await execution.execute();
            ok(Array.isArray(result));
            lengthOf(result, 2);
            eq(result[0], h1);
            eq(result[1], h2);
        });

        it('Should reject with a thrown error', async () => {
            const actionError = Error('foo');
            const action = createActionMock(() => {
                throw actionError;
            });
            const expression = createExpressionMock(action);
            const execution = new Execution(expression, documentObservers, 12345);

            try {
                await execution.execute();
                ok(false);
            }
            catch (error) {
                eq(error, actionError);
            }
        });

        it('Should reject with an error constructor from a tag string', async () => {
            const action = createActionMock(() => executeFatalFailureTag`foo ${1 + 2} bar`);
            const expression = createExpressionMock(action);
            const execution = new Execution(expression, documentObservers, 12345);

            try {
                await execution.execute();
                ok(false);
            }
            catch (error) {
                ok(error instanceof Error);
                eq(error.message, 'foo 3 bar');
            }
        });
    });

    describe('#executeOnce()', () => {
        it('Should return the result of the first check', async () => {
            const h1 = document.createElement('h1');
            const action0 = createActionMock(() => executeSuccess(h1));
            const action1 = createActionMock(() => executeSuccess(h1));
            const expression0 = createExpressionMock(action0);
            const expression1 = createExpressionMock(action1, [expression0]);
            const execution = new Execution(expression1, documentObservers, 12345);

            const executeResult = execution.executeOnce();
            isTrue(action0.execute.calledOnce, 'should immediately call all actions');
            isTrue(action1.execute.calledOnce, 'should immediately call all actions');
            isTrue(execution.fulfilled);
            ok(executeResult === h1);
            ok(await execution.execute() === h1);
        });

        it('Should throw if called multiple times', () => {
            const h1 = document.createElement('h1');
            const action = createActionMock(() => executeSuccess(h1));
            const expression = createExpressionMock(action);
            const execution = new Execution(expression, documentObservers, 12345);

            execution.executeOnce();
            throws(() => execution.executeOnce(), /invalid.*state/i);
        });

        it('Should throw if execute() has already been called', () => {
            const h1 = document.createElement('h1');
            const action = createActionMock(() => executeSuccess(h1));
            const expression = createExpressionMock(action);
            const execution = new Execution(expression, documentObservers, 12345);

            execution.execute().catch(() => {});
            throws(() => execution.executeOnce(), /invalid.*state/i);
        });

        it('Should throw the result of the first check if it fails', async () => {
            const h1 = document.createElement('h1');
            const action0 = createActionMock(() => executeSuccess(h1));
            const action1 = createActionMock(() => executePendingTag`FOO bar`);
            const expression0 = createExpressionMock(action0);
            const expression1 = createExpressionMock(action1, [expression0]);
            const execution = new Execution(expression1, documentObservers, 12345);

            throws(() => execution.executeOnce(), /FOO bar/);
            isTrue(action0.execute.calledOnce, 'should immediately call all actions');
            isTrue(action1.execute.calledOnce, 'should immediately call all actions');
            isTrue(execution.fulfilled);
            eq(await execution.execute().catch(err => err.message), 'FOO bar');
        });
    });

    describe('#check()', () => {
        it('Should throw if firstCheck() has not been called', () => {
            const expression = createExpressionMock(createActionMock(() => executeSuccess(null)));
            const execution = new Execution(expression, documentObservers, 12345);
            throws(() => execution.check(), /check.*execution.*not.*started/i);
        });

        it('Should throw if the execution has been fulfilled', async () => {
            const expression = createExpressionMock(createActionMock(() => executeSuccess(null)));
            const execution = new Execution(expression, documentObservers, 12345);
            await execution.execute();
            throws(() => execution.check(), /check.*execution.*already.*fulfilled/i);
        });

        it('Should call onCheckBegin and onCheckEnd', async () => {
            let actionResult = executePendingTag`foo`;
            const expression = createExpressionMock(createActionMock(() => {
                isTrue(onCheckBegin.called);
                isBelow(onCheckEnd.callCount, onCheckBegin.callCount);
                return actionResult;
            }));
            const execution = new Execution(expression, documentObservers, 12345);
            const onCheckBegin = sinon.spy();
            const onCheckEnd = sinon.spy();
            execution.onCheckBegin = onCheckBegin;
            execution.onCheckEnd = onCheckEnd;

            execution.execute();
            eq(onCheckBegin.callCount, 1);
            eq(onCheckBegin.getCall(0).args[0].expression, expression);
            eq(onCheckBegin.getCall(0).args[0].executionId, 12345);
            eq(onCheckBegin.getCall(0).args[0].resultPromise, execution.executionPromise);
            eq(onCheckEnd.callCount, 1);
            eq(onCheckEnd.getCall(0).args[0].expression, expression);
            eq(onCheckEnd.getCall(0).args[0].executionId, 12345);
            eq(onCheckEnd.getCall(0).args[0].resultPromise, execution.executionPromise);

            actionResult = executeSuccess(null);
            execution.check();
            eq(onCheckBegin.callCount, 2);
            eq(onCheckBegin.getCall(1).args[0].expression, expression);
            eq(onCheckBegin.getCall(1).args[0].executionId, 12345);
            eq(onCheckBegin.getCall(1).args[0].resultPromise, execution.executionPromise);
            eq(onCheckEnd.callCount, 2);
            eq(onCheckEnd.getCall(1).args[0].expression, expression);
            eq(onCheckEnd.getCall(1).args[0].executionId, 12345);
            eq(onCheckEnd.getCall(1).args[0].resultPromise, execution.executionPromise);

            await Promise.all([
                onCheckBegin.getCall(0).args[0].resultPromise,
                onCheckEnd.getCall(0).args[0].resultPromise,
                onCheckBegin.getCall(1).args[0].resultPromise,
                onCheckEnd.getCall(1).args[0].resultPromise,
            ]);
        });
    });
});
