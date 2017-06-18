'use strict';
const {describe, it, beforeEach, afterEach} = require('mocha-sugar-free');
const {assert: {strictEqual: eq, ok, lengthOf, throws, isTrue, isFalse}} = require('chai');
const sinon = require('sinon');
const jsdom = require('jsdom');
const Promise = require('bluebird');

const createMutationObserverMock = require('../createMutationObserverMock');
const DocumentObservers = require('../../lib/DocumentObservers');

const createExecution = () => ({
    check: sinon.spy(function() {
        this._resolve && this._resolve();
    }),
    _waitUntilCheck() {
        return new Promise(resolve => {
            this._resolve = resolve;
        });
    },
});

const USE_JSDOM = !global.window;
const globalWindow = USE_JSDOM
    ? (new jsdom.JSDOM()).window
    : global.window;
const globalDocument = globalWindow.document;
const SUPPORTS_MUTATION_OBSERVER = Boolean(globalWindow.MutationObserver);

if (!SUPPORTS_MUTATION_OBSERVER) {
    createMutationObserverMock(globalWindow);
}

describe('DocumentObservers', () => {
    const createdIframes = [];

    const createDocumentWithView = async () => {
        if (USE_JSDOM) {
            return (new jsdom.JSDOM()).window.document;
        }

        const {document} = global.window;
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', 'about:blank');
        createdIframes.push(iframe);
        document.body.appendChild(iframe);
        const {contentWindow, contentDocument} = iframe;
        if (contentDocument.readyState !== 'complete') {
            await new Promise(resolve => contentWindow.addEventListener('load', resolve));
        }
        return contentDocument;
    };

    afterEach(() => {
        for (const iframe of createdIframes) {
            iframe.remove();
        }
        createdIframes.length = 0;
    });

    describe('#registerExecution()', () => {
        it('Should throw if something else than a HTMLDocument is passed', () => {
            const documentObservers = new DocumentObservers();
            const execution = createExecution();
            throws(() => documentObservers.registerExecution(null, execution), /invalid.*document/i);
            throws(() => documentObservers.registerExecution({}, execution), /invalid.*document/i);
            throws(() => documentObservers.registerExecution(globalWindow, execution), /invalid.*document/i);
            throws(() => documentObservers.registerExecution(globalDocument.createElement('div'), execution), /invalid.*document/i);
        });

        it('Should throw if a HTMLDocument without a browsing context is passed', () => {
            const documentObservers = new DocumentObservers();
            const execution = createExecution();
            const documentWithoutView = globalDocument.implementation.createHTMLDocument('');
            throws(() => documentObservers.registerExecution(documentWithoutView, execution), /document.*must.*browsing.*context/i);
        });

        it('Should reuse the same DocumentObserver for the same HTMLDocument', async () => {
            const documentObservers = new DocumentObservers();
            const execution = createExecution();
            ok(!documentObservers._documentToObserver.has(globalDocument));

            documentObservers.registerExecution(globalDocument, execution);
            const documentObserver = documentObservers._documentToObserver.get(globalDocument);
            isTrue(documentObserver.hasPendingExecutions);
            isTrue(documentObserver.hasRegisteredListeners);

            documentObservers.unregisterExecution(globalDocument, execution);
            await Promise.delay(10);
            eq(documentObservers._documentToObserver.get(globalDocument), documentObserver);
            isFalse(documentObserver.hasPendingExecutions);
            isFalse(documentObserver.hasRegisteredListeners);

            documentObservers.registerExecution(globalDocument, execution);
            eq(documentObservers._documentToObserver.get(globalDocument), documentObserver);
            isTrue(documentObserver.hasPendingExecutions);
            isTrue(documentObserver.hasRegisteredListeners);
        });
    });

    describe('#unregisterExecution()', () => {
        it('Should unregister events deferred', async () => {
            const documentObservers = new DocumentObservers();
            const execution = createExecution();
            ok(!documentObservers._documentToObserver.has(globalDocument));

            documentObservers.registerExecution(globalDocument, execution);
            const documentObserver = documentObservers._documentToObserver.get(globalDocument);
            isTrue(documentObserver.hasRegisteredListeners);

            documentObservers.unregisterExecution(globalDocument, execution);
            eq(documentObservers._documentToObserver.get(globalDocument), documentObserver);
            isFalse(documentObserver.hasPendingExecutions);
            isTrue(documentObserver.hasRegisteredListeners);

            await Promise.delay(10);
            eq(documentObservers._documentToObserver.get(globalDocument), documentObserver);
            isFalse(documentObserver.hasPendingExecutions);
            isFalse(documentObserver.hasRegisteredListeners);

            // unregister again to ensure that we do not error
            documentObservers.unregisterExecution(globalDocument, execution);
            await Promise.delay(10);
            eq(documentObservers._documentToObserver.get(globalDocument), documentObserver);
            isFalse(documentObserver.hasPendingExecutions);
            isFalse(documentObserver.hasRegisteredListeners);
        });

        it('Should not unregister events if not all executions are unregistered', async () => {
            const documentObservers = new DocumentObservers();
            const execution1 = createExecution();
            const execution2 = createExecution();
            ok(!documentObservers._documentToObserver.has(globalDocument));

            documentObservers.registerExecution(globalDocument, execution1);
            documentObservers.registerExecution(globalDocument, execution2);
            const documentObserver = documentObservers._documentToObserver.get(globalDocument);
            isTrue(documentObserver.hasRegisteredListeners);

            documentObservers.unregisterExecution(globalDocument, execution2);
            eq(documentObservers._documentToObserver.get(globalDocument), documentObserver);
            isTrue(documentObserver.hasPendingExecutions);
            isTrue(documentObserver.hasRegisteredListeners);

            await Promise.delay(10);
            eq(documentObservers._documentToObserver.get(globalDocument), documentObserver);
            isTrue(documentObserver.hasPendingExecutions);
            isTrue(documentObserver.hasRegisteredListeners);
        });

        it('Should not unregister events if an execution is registered again', async () => {
            const documentObservers = new DocumentObservers();
            const execution = createExecution();
            ok(!documentObservers._documentToObserver.has(globalDocument));

            documentObservers.registerExecution(globalDocument, execution);
            const documentObserver = documentObservers._documentToObserver.get(globalDocument);

            documentObservers.unregisterExecution(globalDocument, execution);
            documentObservers.registerExecution(globalDocument, execution);
            eq(documentObservers._documentToObserver.get(globalDocument), documentObserver);
            isTrue(documentObserver.hasPendingExecutions);
            isTrue(documentObserver.hasRegisteredListeners);

            await Promise.delay(10);
            eq(documentObservers._documentToObserver.get(globalDocument), documentObserver);
            isTrue(documentObserver.hasPendingExecutions);
            isTrue(documentObserver.hasRegisteredListeners);
        });
    });

    describe('#runAllChecks', () => {
        it('Should immediately check() for all executions', () => {
            const documentObservers = new DocumentObservers();
            const execution = createExecution();
            documentObservers.registerExecution(globalDocument, execution);
            isTrue(execution.check.notCalled, 'should not check for no reason');

            documentObservers.runAllChecks(globalDocument.implementation.createHTMLDocument(''));
            isTrue(execution.check.notCalled, 'should not check if called for a different document');

            documentObservers.runAllChecks(globalDocument);
            isTrue(execution.check.calledOnce);
        });
    });

    describe('#runAllChecksDeferred', {slow: 500}, () => {
        it('Should defer a check() for all executions', async () => {
            const documentObservers = new DocumentObservers();
            const execution = createExecution();
            documentObservers.registerExecution(globalDocument, execution);
            isTrue(execution.check.notCalled, 'should not check for no reason');

            documentObservers.runAllChecksDeferred(globalDocument.implementation.createHTMLDocument(''));
            isTrue(execution.check.notCalled, 'should not check if called for a different document');
            await Promise.delay(100); // give the deferral a chance to run
            isTrue(execution.check.notCalled, 'should not check if called for a different document');

            documentObservers.runAllChecksDeferred(globalDocument);
            isTrue(execution.check.notCalled, 'should not check immediately');
            await execution._waitUntilCheck();
        });
    });

    describe('#drainDeferrals', () => {
        it('Should immediately check all previously deferred checks', () => {
            const documentObservers = new DocumentObservers();
            const execution = createExecution();
            documentObservers.registerExecution(globalDocument, execution);
            isTrue(execution.check.notCalled, 'should not check for no reason');

            documentObservers.runAllChecksDeferred(globalDocument);
            isTrue(execution.check.notCalled, 'should not check immediately');

            documentObservers.drainDeferrals(globalDocument.implementation.createHTMLDocument(''));
            isTrue(execution.check.notCalled, 'should not check if called for a different document');

            documentObservers.drainDeferrals(globalDocument);
            isTrue(execution.check.calledOnce, 'should check immediately');

            documentObservers.drainDeferrals(globalDocument);
            isTrue(execution.check.calledOnce, 'should not check again because a check was not previously deferred');
        });
    });

    describe('Event listeners', {slow: 500, timeout: 10000}, () => {
        let documentObservers;
        let window;
        let document;
        let execution;

        beforeEach(async () => {
            documentObservers = new DocumentObservers();
            document = await createDocumentWithView();
            window = document.defaultView;
            if (!window.MutationObserver) { // jsdom
                createMutationObserverMock(window);
            }
            execution = createExecution();
        });

        afterEach(() => {
            documentObservers.unregisterExecution(document, execution);
            documentObservers = null;
            document = null;
        });

        it('Should immediately check() upon window "load" events', () => {
            documentObservers.registerExecution(document, execution);
            isTrue(execution.check.notCalled, 'should not check for no reason');
            isTrue(window.dispatchEvent(new window.Event('load')), 'should not cancel the event');
            isTrue(execution.check.calledOnce);
        });

        it('Should only register events once', () => {
            const documentObservers = new DocumentObservers();
            const execution1 = createExecution();
            const execution2 = createExecution();
            const execution3 = createExecution();

            documentObservers.registerExecution(document, execution1);
            documentObservers.registerExecution(document, execution2);
            documentObservers.registerExecution(document, execution3);
            documentObservers.registerExecution(document, execution1);

            isTrue(execution1.check.notCalled, 'should not check for no reason');
            isTrue(execution2.check.notCalled, 'should not check for no reason');
            isTrue(execution3.check.notCalled, 'should not check for no reason');
            isTrue(window.dispatchEvent(new window.Event('load')), 'should not cancel the event');
            isTrue(execution1.check.calledOnce);
            isTrue(execution2.check.calledOnce);
            isTrue(execution3.check.calledOnce);
        });

        it('Should immediately check() upon window "DOMContentLoaded" events', () => {
            documentObservers.registerExecution(document, execution);
            isTrue(execution.check.notCalled, 'should not check for no reason');
            isTrue(window.document.dispatchEvent(new window.Event('DOMContentLoaded')), 'should not cancel the event');
            isTrue(execution.check.calledOnce);
        });

        it('Should defer a check() upon element load events', async () => {
            const img = document.createElement('img');
            document.body.appendChild(img);

            const event = new window.Event('load', {
                bubbles: true,
                cancelable: false,
            });
            documentObservers.registerExecution(document, execution);
            await Promise.delay(100); // wait a bit to ensure that we are not responding to a delayed MutationObserver callback
            isTrue(execution.check.notCalled, 'should not check for no reason');
            isTrue(img.dispatchEvent(event), 'should not cancel the event');
            isTrue(execution.check.notCalled, 'the check should not be immediate');
            await execution._waitUntilCheck();
            isTrue(execution.check.calledOnce);
            await Promise.delay(100); // wait a bit to ensure that the check is not called again
            isTrue(execution.check.calledOnce);
        });

        it('Should defer a check() upon element error events', async () => {
            const img = document.createElement('img');
            document.body.appendChild(img);

            const event = new window.Event('error', {
                bubbles: true,
                cancelable: false,
            });
            documentObservers.registerExecution(document, execution);
            await Promise.delay(100); // wait a bit to ensure that we are not responding to a delayed MutationObserver callback
            isTrue(execution.check.notCalled, 'should not check for no reason');
            isTrue(img.dispatchEvent(event), 'should not cancel the event');
            isTrue(execution.check.notCalled, 'the check should not be immediate');
            await execution._waitUntilCheck();
            isTrue(execution.check.calledOnce);
            await Promise.delay(100); // wait a bit to ensure that the check is not called too often
            isTrue(execution.check.calledOnce);
        });

        it('Should defer a check() document is mutated (mocked)', {skip: SUPPORTS_MUTATION_OBSERVER}, async () => {
            documentObservers.registerExecution(document, execution);
            isTrue(execution.check.notCalled, 'should not check for no reason');

            document.body.appendChild(document.createElement('div'));
            document.body.appendChild(document.createElement('p'));
            lengthOf(window.mutationObserverMocks, 1);

            setTimeout(() => window.mutationObserverMocks[0](), 10); // defer it just like a real mutation observer
            await execution._waitUntilCheck();
            isTrue(execution.check.calledOnce);

            await Promise.delay(100); // wait a bit to ensure that the check is not called too often
            isTrue(execution.check.calledOnce);
        });

        describe('Mutation observer tests', {skip: !SUPPORTS_MUTATION_OBSERVER}, () => {
            it('Should defer a check() when elements are added or removed from the document', async () => {
                documentObservers.registerExecution(document, execution);
                isTrue(execution.check.notCalled, 'should not check for no reason');

                const div = document.createElement('div');
                document.body.appendChild(div);
                document.body.appendChild(document.createElement('p'));
                await execution._waitUntilCheck();
                isTrue(execution.check.calledOnce);

                await Promise.delay(100); // wait a bit to ensure that the check is not called too often
                isTrue(execution.check.calledOnce);

                div.remove();
                await execution._waitUntilCheck();
                isTrue(execution.check.calledTwice);
            });

            it('Should defer a check() when an element attribute is changed', async () => {
                documentObservers.registerExecution(document, execution);
                isTrue(execution.check.notCalled, 'should not check for no reason');

                document.body.setAttribute('class', 'foo');
                await execution._waitUntilCheck();
                isTrue(execution.check.calledOnce);

                await Promise.delay(100); // wait a bit to ensure that the check is not called too often
                isTrue(execution.check.calledOnce);

                document.body.removeAttribute('class');
                await execution._waitUntilCheck();
                isTrue(execution.check.calledTwice);
            });

            it('Should defer a check() when character data is modified', async () => {
                documentObservers.registerExecution(document, execution);
                isTrue(execution.check.notCalled, 'should not check for no reason');

                const textNode = document.createTextNode('foo');
                document.body.appendChild(textNode);
                await execution._waitUntilCheck();
                isTrue(execution.check.calledOnce);

                await Promise.delay(100); // wait a bit to ensure that the check is not called too often
                isTrue(execution.check.calledOnce);

                textNode.data = 'bar';
                await execution._waitUntilCheck();
                isTrue(execution.check.calledTwice);
            });
        });

        it('Should not call check() if the execution has been unregistered', async () => {
            documentObservers.registerExecution(document, execution);
            documentObservers.unregisterExecution(document, execution);

            document.body.appendChild(document.createElement('p'));
            document.dispatchEvent(new window.Event('DOMContentLoaded'));
            document.dispatchEvent(new window.Event('load'));
            document.body.dispatchEvent(new window.Event('load', {bubbles: true, cancelable: false}));
            document.body.dispatchEvent(new window.Event('error', {bubbles: true, cancelable: false}));

            await Promise.delay(100); // wait a bit to ensure that the check is not called
            isTrue(execution.check.notCalled);
        });
    });
});
