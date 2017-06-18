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
        this._documentObservers = new DocumentObservers();
        this._nextExecutionId = 0;
        this.onExecuteBegin = null; // ({expression, executionId, resultPromise}) => undefined
        this.onExecuteEnd = null; // ({expression, executionId, resultPromise}) => undefined
        this.onCheckBegin = null; // ({expression, executionId, resultPromise}) => undefined
        this.onCheckEnd = null; // ({expression, executionId, resultPromise}) => undefined
    }

    createNextExpression(action, timeout = 30000) {
        return new Expression(null, action, timeout, this._expressionExecutor);
    }

    runAllChecks(document) {
        this._documentObservers.runAllChecks(document);
    }

    runAllChecksDeferred(document) {
        this._documentObservers.runAllChecksDeferred(document);
    }

    async _expressionExecutor(expression) {
        const execution = new Execution(expression, this._documentObservers, this._nextExecutionId++);
        const {onExecuteBegin, onExecuteEnd, onCheckBegin, onCheckEnd} = this;
        execution.onCheckBegin = onCheckBegin;
        execution.onCheckEnd = onCheckEnd;

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
}

module.exports = Bluefox;
