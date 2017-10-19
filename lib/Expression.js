'use strict';
const ExpressionChainable = require('./ExpressionChainable');
const {DEFAULT_AMOUNT_ACTION} = require('./actions');

/* istanbul ignore if */
if (!DEFAULT_AMOUNT_ACTION.appliesAmountCheck) {
    // infinite recursion would occur in this case
    throw Error('Assertion Error');
}

class Expression extends ExpressionChainable {
    constructor({previous, action, timeoutMs, executor, onceExecutor, thenable = true}) {
        super();

        if (previous !== null && !(previous instanceof Expression)) {
            throw Error('Invalid argument `previous`');
        }

        if (Boolean(previous) === Boolean(executor)) {
            throw Error('`executor` must (only) be set for the root Expression');
        }

        if (Boolean(previous) === Boolean(onceExecutor)) {
            throw Error('`onceExecutor` must (only) be set for the root Expression');
        }

        if (!action ||
            typeof action !== 'object' ||
            typeof action.execute !== 'function' ||
            typeof action.describe !== 'function') {
            throw Error('Invalid argument `action`');
        }

        if (typeof timeoutMs !== 'number') {
            throw Error('Invalid argument `timeoutMs`');
        }

        const prevConfig = previous && previous.configuration;
        const prevWantsDefaultAmountCheck = prevConfig && prevConfig.wantsDefaultAmountCheck;
        const wantsDefaultAmountCheck =
            (prevWantsDefaultAmountCheck || action.wantsDefaultAmountCheck) &&
            !action.appliesAmountCheck;

        // store our own data under a single property to avoid a messy user facing API
        Object.defineProperty(this, 'configuration', {
            value: {
                previous,
                depth: prevConfig ? prevConfig.depth + 1 : 0,
                action,
                timeout: timeoutMs,
                additionalCheckTimeout: Object.freeze([timeoutMs, ...action.additionalCheckTimeout]),
                _executor: prevConfig ? prevConfig._executor : executor,
                _onceExecutor: prevConfig ? prevConfig._onceExecutor : onceExecutor,
                wantsDefaultAmountCheck,
                _defaultAmountExpression: null,
            },
        });

        this.configuration._defaultAmountExpression = wantsDefaultAmountCheck
            ? new Expression({
                previous: this,
                action: DEFAULT_AMOUNT_ACTION,
                timeoutMs: timeoutMs,
            })
            : null;

        if (!thenable) {
            // we only need to shadow `then` to avoid the magic thenable behaviour of promise handlers
            // however we also get rid of catch, finally for consistencies sake
            this.then = undefined;
            this.catch = undefined;
            this.finally = undefined;
        }

        Object.freeze(this.configuration);
        Object.freeze(this);
    }

    getExpressionChain() {
        const {_defaultAmountExpression} = this.configuration;
        if (_defaultAmountExpression) {
            return _defaultAmountExpression.getExpressionChain();
        }

        const expressionCount = this.configuration.depth + 1;
        const result = new Array(expressionCount);
        let currentExpression = this;
        for (let i = expressionCount - 1; i >= 0; --i) {
            result[i] = currentExpression;
            const {previous} = currentExpression.configuration;
            currentExpression = previous;
        }

        /* istanbul ignore if */
        if (currentExpression) {
            throw Error('Assertion Error');
        }

        return result;
    }

    createNextExpression(action, {timeoutMs = this.configuration.timeout, thenable = true} = {}) {
        return new Expression({
            previous: this,
            action,
            timeoutMs,
            thenable,
        });
    }

    describe() {
        const descriptions = [];

        for (const expression of this.getExpressionChain()) {
            const {configuration} = expression;
            const description = configuration.action.describe(configuration.timeout);
            if (description) {
                descriptions.push(description);
            }
        }

        return `The expression ${descriptions.join(', ')}.`;
    }

    async execute() {
        return await this.configuration._executor(this);
    }

    then(...args) {
        // Note the intentional difference between:
        //   expression = wait.selector('foo')
        //   await expression;
        //   await expression; // execute again!
        // and:
        //   promise = wait.selector('foo').execute()
        //   await expression;
        //   await expression;
        return this.execute().then(...args);
    }

    catch(...args) {
        return this.execute().catch(...args);
    }

    finally(handler) {
        return this.then(
            value => Promise.resolve(handler()).then(() => value),
            error => Promise.resolve(handler()).then(() => Promise.reject(error))
        );
    }

    executeOnce() {
        return this.configuration._onceExecutor(this);
    }
}

module.exports = Expression;
