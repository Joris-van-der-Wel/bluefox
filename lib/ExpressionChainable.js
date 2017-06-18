'use strict';
const actions = require('./actions');

/** @constructor */
class ExpressionChainable {
    /**
     * @param {actions.Action} action
     * @param {number} [timeout=previous.timeout]
     * @return {ExpressionChainable}
     * @method createNextExpression
     * @memberof ExpressionChainable.prototype
     */

    /**
     * @param {actions.Action} action
     * @return {ExpressionChainable}
     */
    action(action) {
        return this.createNextExpression(action);
    }

    /**
     * @param {Window|Node|Array|Function} targets
     * @return {ExpressionChainable}
     */
    target(targets) {
        return this.createNextExpression(new actions.Target(targets));
    }

    /**
     * @param {number|string} timeout string in the format of "10s" to specify seconds or a number to specify milliseconds
     * @return {ExpressionChainable}
     */
    timeout(timeout) {
        const timeoutMs = actions.parseTimeoutArgument(timeout);
        return this.createNextExpression(new actions.Noop(), timeoutMs);
    }

    /**
     * @param {number} minimum
     * @param {number} maximum
     * @return {ExpressionChainable}
     */
    amount(minimum, maximum) {
        return this.createNextExpression(new actions.Amount(minimum, maximum));
    }

    /**
     * @param {string|Function} expression
     * @return {ExpressionChainable}
     */
    selector(expression) {
        return this.createNextExpression(new actions.Selector(expression));
    }

    /**
     * @param {string|Function} expression
     * @return {ExpressionChainable}
     */
    selectorAll(expression) {
        return this.createNextExpression(new actions.SelectorAll(expression));
    }

    /**
     * @param {string|Function} expression
     * @return {ExpressionChainable}
     */
    xpath(expression) {
        return this.createNextExpression(new actions.XPath(expression));
    }

    /**
     * @param {string|Function} expression
     * @return {ExpressionChainable}
     */
    xpathAll(expression) {
        return this.createNextExpression(new actions.XPathAll(expression));
    }

    /**
     * @return {ExpressionChainable}
     */
    documentInteractive() {
        return this.createNextExpression(new actions.DocumentInteractive());
    }

    /**
     * @return {ExpressionChainable}
     */
    documentComplete() {
        return this.createNextExpression(new actions.DocumentComplete());
    }
}

module.exports = ExpressionChainable;
