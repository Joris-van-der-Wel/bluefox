'use strict';
const actions = require('./actions');
const {cssSelectorTag} = require('./dom');

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
        return this.createNextExpression(new actions.Noop(), {timeoutMs});
    }

    /**
     * @param {?number} unixTimeMs Unix time in milliseconds (same as Date.now())
     * @return {ExpressionChainable}
     */
    overrideStartTime(unixTimeMs) {
        if (unixTimeMs !== null) {
            if (typeof unixTimeMs !== 'number' || !Number.isFinite(unixTimeMs)) {
                throw Error('.overrideStartTime(unixTimeMs): unixTimeMs must be a finite number or null');
            }
        }

        return this.createNextExpression(new actions.Noop(), {overrideStartTime: unixTimeMs});
    }

    /**
     * @return {ExpressionChainable}
     */
    notThenable() {
        return this.createNextExpression(new actions.Noop(), {thenable: false});
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
    selector(expression, ...tagValues) {
        const expressionString = Array.isArray(expression)
            ? cssSelectorTag(expression, tagValues)
            : expression;
        return this.createNextExpression(new actions.Selector(expressionString));
    }

    /**
     * @param {string|Function} expression
     * @return {ExpressionChainable}
     */
    selectorAll(expression, ...tagValues) {
        const expressionString = Array.isArray(expression)
            ? cssSelectorTag(expression, tagValues)
            : expression;
        return this.createNextExpression(new actions.SelectorAll(expressionString));
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

    /**
     * @param {number|string} timeout string in the format of "10s" to specify seconds or a number to specify milliseconds
     * @return {ExpressionChainable}
     */
    delay(timeout) {
        return this.createNextExpression(new actions.Delay(timeout));
    }

    /**
     * @return {ExpressionChainable}
     */
    isDisplayed() {
        return this.createNextExpression(new actions.IsDisplayed());
    }

    /**
     * @param {function} callback
     * @return {ExpressionChainable}
     */
    check(callback) {
        return this.createNextExpression(new actions.Check(callback));
    }

    /**
     * @param {string|RegExp} text
     * @return {ExpressionChainable}
     */
    containsText(text) {
        return this.createNextExpression(new actions.ContainsText(text));
    }
}

module.exports = ExpressionChainable;
