'use strict';
const {ResultWrapper, RESULT_STATUS_SUCCESS, RESULT_STATUS_PENDING} = require('./result');
const Timer = require('./Timer');

class Execution {
    constructor(expression, documentObservers, id) {
        this.expression = expression;
        this.expressionChain = expression.getExpressionChain();
        this.documentObservers = documentObservers;
        this.id = id;
        this.onCheckBegin = null;
        this.onCheckEnd = null;
        this.executionPromise = new Promise((resolve, reject) => {
            this.executionResolve = resolve;
            this.executionReject = reject;
        });
        this.executionStart = null;
        this.didFirstCheck = false;
        this.fulfilled = false;
        this.registeredDocuments = new Set();
        this.additionalCheckTimers = new Map();
        this._handleAdditionalCheckTimer = this._handleAdditionalCheckTimer.bind(this);
        this.createTimer = (timeout, handler) => new Timer(timeout, handler);
        this.now = () => Date.now();
    }

    async execute() {
        if (!this.didFirstCheck) {
            // immediately trigger the very first check, this also ensures that all
            // event handlers are added to the appropriate DOMWindow(s), which then
            // triggers any further check
            this.firstCheck();
        }
        return this.executionPromise;
    }

    executeOnce() {
        const result = this.firstCheck();
        this.fulfill(result);
        this.executionPromise.catch(() => {}); // shut up UnhandledPromiseRejectionWarning
        if (result.lastResultStatus === RESULT_STATUS_SUCCESS) {
            return result.value;
        }
        throw result.getFailureError();
    }

    firstCheck() {
        if (this.didFirstCheck) {
            throw Error('Invalid state');
        }

        const now = this.now();
        this.didFirstCheck = true;
        this.executionStart = now;

        for (const expression of this.expressionChain) {
            const {additionalCheckTimeout, overrideStartTime} = expression.configuration;

            for (const timeout of additionalCheckTimeout) {
                if (!this.additionalCheckTimers.has(timeout)) {
                    const timer = this.createTimer(timeout, this._handleAdditionalCheckTimer);
                    timer.schedule();
                    this.additionalCheckTimers.set(timeout, timer);
                }
            }

            if (overrideStartTime === null) {
                this.executionStart = now;
            }
            else if (typeof overrideStartTime === 'number') {
                this.executionStart = overrideStartTime;
            }
        }

        return this.check();
    }

    check() {
        if (!this.didFirstCheck) {
            throw Error('Execution#check(): This execution has not been started');
        }

        if (this.fulfilled) {
            throw Error('Execution#check(): This execution has already been fulfilled');
        }

        const {onCheckBegin, onCheckEnd} = this;

        onCheckBegin && onCheckBegin({
            expression: this.expression,
            executionId: this.id,
            resultPromise: this.executionPromise,
        });

        const {executionStart} = this;
        const checkStart = this.now();
        const currentDuration = checkStart - executionStart;
        const result = new ResultWrapper();
        const documents = new Set();
        let pendingExpression = false;

        for (const expression of this.expressionChain) {
            const metaData = Object.freeze({
                executionStart,
                checkStart,
            });
            const resultStatus = result.runAction(expression.configuration.action, metaData);

            if (resultStatus === RESULT_STATUS_PENDING) {
                pendingExpression = expression;
            }

            if (resultStatus !== RESULT_STATUS_SUCCESS) {
                break;
            }

            result.addDOMDocumentsToSet(documents);
        }

        if (pendingExpression) {
            const {timeout} = pendingExpression.configuration;

            if (currentDuration >= timeout) {
                this.fulfilled = true;
                this.cleanup();
                this.executionReject(this.timeoutError(timeout, result, pendingExpression));
            }
            else {
                // expression was not fulfilled, listen for some events to trigger a recheck
                this.updateDocumentRegistrations(documents);
            }
        }
        else {
            this.fulfill(result);
        }

        onCheckEnd && onCheckEnd({
            expression: this.expression,
            executionId: this.id,
            resultPromise: this.executionPromise,
        });

        return result;
    }

    timeoutError(timeout, result, pendingExpression) {
        const actionFailure = result.failureString();
        const message = `Wait expression timed out after ${timeout / 1000} seconds because ${actionFailure}. ` +
            pendingExpression.describe();
        const error = new Error(message);
        error.name = 'BluefoxTimeoutError';
        error.timeout = timeout;
        error.actionFailure = actionFailure;
        error.expression = pendingExpression;
        error.fullExpression = this.expression;
        return error;
    }

    updateDocumentRegistrations(documents) {
        for (const document of this.registeredDocuments) {
            if (!documents.has(document)) {
                this.documentObservers.unregisterExecution(document, this);
            }
        }
        for (const document of documents) {
            // (it is okay to call this method too many times)
            this.documentObservers.registerExecution(document, this);
        }
        this.registeredDocuments = documents;
    }

    cleanup() {
        for (const window of this.registeredDocuments) {
            this.documentObservers.unregisterExecution(window, this);
        }
        this.registeredDocuments.clear();

        for (const timer of this.additionalCheckTimers.values()) {
            timer.cancel();
        }
        this.additionalCheckTimers.clear();
    }

    fulfill(result) {
        this.fulfilled = true;
        this.cleanup();

        if (result.lastResultStatus === RESULT_STATUS_SUCCESS) {
            this.executionResolve(result.value);
        }
        else {
            this.executionReject(result.getFailureError());
        }
    }

    _handleAdditionalCheckTimer() {
        this.check();
    }
}

module.exports = Execution;
