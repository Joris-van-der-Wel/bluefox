'use strict';
const ExpressionChainable = require('./ExpressionChainable');
const Expression = require('./Expression');
const Execution = require('./Execution');
const DocumentObservers = require('./DocumentObservers');
const Timer = require('./Timer');

class Bluefox extends ExpressionChainable {
    static setTimerFunctions(setTimeout, clearTimeout) {
        Timer.setTimeout = setTimeout;
        Timer.clearTimeout = clearTimeout;
    }

    constructor() {
        super();
        this._expressionExecutor = this._expressionExecutor.bind(this);
        this._expressionOnceExecutor = this._expressionOnceExecutor.bind(this);
        this._documentObservers = new DocumentObservers();
        this._nextExecutionId = 0;
        this.onExecuteBegin = null; // ({expression, executionId, resultPromise}) => undefined
        this.onExecuteEnd = null; // ({expression, executionId, resultPromise}) => undefined
        this.onCheckBegin = null; // ({expression, executionId, resultPromise}) => undefined
        this.onCheckEnd = null; // ({expression, executionId, resultPromise}) => undefined
    }

    createNextExpression(action, {timeoutMs = 30000, thenable = true, overrideStartTime} = {}) {
        return new Expression({
            previous: null,
            action: action,
            timeoutMs,
            executor: this._expressionExecutor,
            onceExecutor: this._expressionOnceExecutor,
            thenable,
            overrideStartTime,
        });
    }

    runAllChecks(document) {
        this._documentObservers.runAllChecks(document);
    }

    runAllChecksDeferred(document) {
        this._documentObservers.runAllChecksDeferred(document);
    }

    _createExecution(expression) {
        const execution = new Execution(expression, this._documentObservers, this._nextExecutionId++);
        const {onCheckBegin, onCheckEnd} = this;
        execution.onCheckBegin = onCheckBegin;
        execution.onCheckEnd = onCheckEnd;
        return execution;
    }

    async _expressionExecutor(expression) {
        const execution = this._createExecution(expression);
        const {onExecuteBegin, onExecuteEnd} = this;

        onExecuteBegin && onExecuteBegin({
            expression,
            executionId: execution.id,
            resultPromise: execution.executionPromise,
        });

        try {
            return await execution.execute();
        }
        finally {
            onExecuteEnd && onExecuteEnd({
                expression,
                executionId: execution.id,
                resultPromise: execution.executionPromise,
            });
        }
    }

    _expressionOnceExecutor(expression) {
        const execution = this._createExecution(expression);
        return execution.executeOnce();
    }
}

module.exports = Bluefox;
