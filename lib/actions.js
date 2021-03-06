'use strict';
const {
    isResultItem,
    isDOMNode,
    describeDOMObject,
    cssSelectorFirst,
    cssSelectorArray,
    xpathFirst,
    xpathArray,
    resultItemToDocument,
    documentReadyState,
    hasFormattingBox,
    textContent,
} = require('./dom');
const {resultToArray, resultCount, executeSuccess, executePendingTag, executeFatalFailureTag} = require('./result');

const freezeCopyIfArray = value => {
    if (Array.isArray(value)) {
        return Object.freeze(value.slice());
    }
    return value;
};
const funcOrValue = value => (typeof value === 'function' ? value() : value);
const LEFT_QUOTE = '\u201c';
const RIGHT_QUOTE = '\u201d';
const HORIZONTAL_ELLIPSIS = '\u2026';
const EMPTY_FROZEN_ARRAY = Object.freeze([]);
const CALLBACK_DESCRIPTION_MAX_LENGTH = 64;

exports.parseTimeoutArgument = timeout => {
    if (typeof timeout === 'string' && /^([\d.]+)s$/.test(timeout)) {
        return parseFloat(timeout) * 1000;
    }

    if (typeof timeout === 'number') {
        return timeout;
    }

    throw Error('Invalid timeout argument, expected a number or a duration string');
};

exports.describeCallback = func => {
    const funcString = func.toString();
    if (funcString.length <= CALLBACK_DESCRIPTION_MAX_LENGTH) {
        return funcString;
    }

    return funcString.slice(0, CALLBACK_DESCRIPTION_MAX_LENGTH - 1) + HORIZONTAL_ELLIPSIS;
};

class Action {
    /**
     * @param {?Window|Node|Array.<(Window|Node)>} currentResult
     * @param {Object} metaData
     * @return {{status: string, reasonStrings: string[], reasonValues: string[], value: (?Window|Node|Array.<(Window|Node)>)}}
     */
    execute(currentResult, metaData) {
        return executeSuccess(currentResult);
    }

    /**
     * @param {number} timeout milliseconds
     * @return {string}
     */
    describe(timeout) {
        return '';
    }

    /**
     * If true, this action should trigger a default amount check. Unless the user provides an amount check
     * For example if this value is true for "myAction": `.myAction()` would have the same effect as `.myAction().amount(1, Infinity)`
     * @return {boolean}
     */
    get wantsDefaultAmountCheck() {
        return false;
    }

    /**
     * If true, this action perform an an amount check and the default amount check should not be applied.
     * @return {boolean}
     */
    get appliesAmountCheck() {
        return false;
    }

    /**
     * Schedule an additional check after this many milliseconds have passed since the start of the expression
     * @return {number[]}
     */
    get additionalCheckTimeout() {
        return EMPTY_FROZEN_ARRAY;
    }
}

class Noop extends Action {
    constructor() {
        super();
        Object.freeze(this);
    }

    execute(currentResult) {
        return executeSuccess(currentResult);
    }

    describe() {
        return '';
    }
}

class Target extends Action {
    /**
     * @param {?Window|Node|Array.<(Window|Node)>|Function} targets
     */
    constructor(targets) {
        super();
        this.results = freezeCopyIfArray(targets);
        Object.freeze(this);
    }

    execute(currentResult) {
        const results = freezeCopyIfArray(funcOrValue(this.results));

        for (const result of resultToArray(results)) {
            if (!isResultItem(result)) {
                return executeFatalFailureTag`a value that is not a WindowProxy nor a HTMLDocument, nor an Element was set as the target`;
            }
        }

        return executeSuccess(results);
    }

    describe() {
        const results = this.results;
        // (some DOM nodes are typeof function)
        if (typeof results === 'function' && !isDOMNode(results)) {
            return `sets the target using a callback: \`${exports.describeCallback(results)}\``;
        }

        if (Array.isArray(results)) {
            const descriptions = [];

            for (const result of results) {
                if (descriptions.length >= 5) {
                    descriptions.push('\u2026');
                    break;
                }

                descriptions.push(describeDOMObject(result));
            }

            return `sets the target to [${descriptions.join(', ')}]`;
        }

        return `sets the target to ${describeDOMObject(results)}`;
    }
}

class Amount extends Action {
    constructor(minimum, maximum = minimum) {
        super();
        this.minimum = minimum;
        this.maximum = maximum;

        if (typeof this.minimum !== 'number') {
            throw Error('.amount(minimum, maximum): minimum must be a number');
        }

        if (typeof this.maximum !== 'number') {
            throw Error('.amount(minimum, maximum): maximum must be a number');
        }

        if (this.minimum > this.maximum) {
            throw Error('.amount(minimum, maximum): maximum must be greater than or equal to minimum');
        }

        Object.freeze(this);
    }

    execute(currentResult) {
        const count = resultCount(currentResult);

        if (count < this.minimum) {
            if (count === 0) {
                return executePendingTag`no results were found, instead of a minimum of ${this.minimum} results`;
            }

            return executePendingTag`only ${count} results were found, instead of a minimum of ${this.minimum} results`;
        }

        if (count > this.maximum) {
            return executePendingTag`${count} results were found, instead of a maximum of ${this.maximum} results`;
        }

        return executeSuccess(currentResult);
    }

    describe(timeout) {
        const prefix = `waits up to ${timeout / 1000} seconds until`;

        if (this.minimum === this.maximum) {
            return `${prefix} exactly ${this.minimum} results are found`;
        }

        if (this.minimum === 1 && this.maximum === Infinity) {
            return `${prefix} a result is found`;
        }

        if (this.maximum === Infinity) {
            return `${prefix} ${this.minimum} or more results are found`;
        }

        return `${prefix} between ${this.minimum} and ${this.maximum} (inclusive) results are found`;
    }

    get appliesAmountCheck() {
        return true;
    }
}

class Selector extends Action {
    constructor(expression) {
        super();
        this.expression = expression;
        Object.freeze(this);
    }

    execute(currentResult) {
        const expression = funcOrValue(this.expression);

        for (const resultItem of resultToArray(currentResult)) {
            const result = cssSelectorFirst(resultItem, expression);

            if (result) {
                return executeSuccess(result);
            }
        }

        return executeSuccess(null);
    }

    describe() {
        if (typeof this.expression === 'function') {
            return `finds the first descendant element matching a CSS selector from ` +
                `a callback: \`${exports.describeCallback(this.expression)}\``;
        }

        return `finds the first descendant element matching the CSS selector ${LEFT_QUOTE}${this.expression}${RIGHT_QUOTE}`;
    }

    get wantsDefaultAmountCheck() {
        return true;
    }
}

class SelectorAll extends Action {
    constructor(expression) {
        super();
        this.expression = expression;
        Object.freeze(this);
    }

    execute(currentResult) {
        const expression = funcOrValue(this.expression);
        const elementListList = [];

        for (const resultItem of resultToArray(currentResult)) {
            const elementList = cssSelectorArray(resultItem, expression);
            elementListList.push(elementList);
        }

        const value = [].concat(...elementListList);
        Object.freeze(value);
        return executeSuccess(value);
    }

    describe() {
        if (typeof this.expression === 'function') {
            return `finds all descendant elements matching a CSS selector from a callback: ` +
                `\`${exports.describeCallback(this.expression)}\``;
        }

        return `finds all descendant elements matching the CSS selector ${LEFT_QUOTE}${this.expression}${RIGHT_QUOTE}`;
    }

    get wantsDefaultAmountCheck() {
        return true;
    }
}

class XPath extends Action {
    constructor(expression) {
        super();
        this.expression = expression;
        Object.freeze(this);
    }

    execute(currentResult) {
        const expression = funcOrValue(this.expression);

        for (const resultItem of resultToArray(currentResult)) {
            const result = xpathFirst(resultItem, expression);

            if (result && !isResultItem(result)) {
                return executeFatalFailureTag`a value that is not an Element was returned by the XPath expression`;
            }

            if (result) {
                return executeSuccess(result);
            }
        }

        return executeSuccess(null);
    }

    describe() {
        if (typeof this.expression === 'function') {
            return `finds the first element matching a XPath expression from a callback: ` +
                `\`${exports.describeCallback(this.expression)}\``;
        }

        return `finds the first element matching the XPath expression ${LEFT_QUOTE}${this.expression}${RIGHT_QUOTE}`;
    }

    get wantsDefaultAmountCheck() {
        return true;
    }
}

class XPathAll extends Action {
    constructor(expression) {
        super();
        this.expression = expression;
        Object.freeze(this);
    }

    execute(currentResult) {
        const expression = funcOrValue(this.expression);
        const elementListList = [];

        for (const resultItem of resultToArray(currentResult)) {
            const elementList = xpathArray(resultItem, expression);
            elementListList.push(elementList);
        }

        const value = [].concat(...elementListList);
        Object.freeze(value);

        for (const resultItem of value) {
            if (!isResultItem(resultItem)) {
                return executeFatalFailureTag`a value that is not an Element was returned by the XPath expression`;
            }
        }

        return executeSuccess(value);
    }

    describe() {
        if (typeof this.expression === 'function') {
            return `finds all elements matching a XPath expression from a callback: ` +
                `\`${exports.describeCallback(this.expression)}\``;
        }

        return `finds all elements matching the XPath expression ${LEFT_QUOTE}${this.expression}${RIGHT_QUOTE}`;
    }

    get wantsDefaultAmountCheck() {
        return true;
    }
}

class DocumentInteractive extends Action {
    constructor() {
        super();
        Object.freeze(this);
    }

    execute(currentResult) {
        for (const resultItem of resultToArray(currentResult)) {
            const document = resultItemToDocument(resultItem);

            if (documentReadyState(document) === 'loading') {
                return executePendingTag`the HTML document has not yet been parsed`;
            }
        }

        return executeSuccess(currentResult);
    }

    describe(timeout) {
        return `waits up to ${timeout / 1000} seconds until the HTML document has finished parsing`;
    }
}

class DocumentComplete extends Action {
    constructor() {
        super();
        Object.freeze(this);
    }

    execute(currentResult) {
        for (const resultItem of resultToArray(currentResult)) {
            const document = resultItemToDocument(resultItem);

            const readyState = documentReadyState(document);
            if (readyState === 'loading') {
                return executePendingTag`the HTML document has not yet been parsed`;
            }

            if (readyState === 'interactive') {
                return executePendingTag`the HTML document has not yet been loaded`;
            }
        }

        return executeSuccess(currentResult);
    }

    describe(timeout) {
        return `waits up to ${timeout / 1000} seconds until all synchronous resources of the HTML document have been loaded`;
    }
}

class Delay extends Action {
    constructor(timeout) {
        super();
        this.delayMs = exports.parseTimeoutArgument(timeout);
        Object.freeze(this);
    }

    execute(currentResult, {executionStart, checkStart}) {
        const {delayMs} = this;
        const timeSinceStart = checkStart - executionStart;
        if (timeSinceStart < delayMs) {
            // eslint-disable-next-line max-len
            return executePendingTag`the delay of ${delayMs / 1000} seconds has not yet elapsed, only ${timeSinceStart / 1000} seconds have elapsed so far`;
        }

        return executeSuccess(currentResult);
    }

    describe() {
        return `waits until ${this.delayMs / 1000} seconds have elapsed since the start of the execution`;
    }

    get additionalCheckTimeout() {
        return Object.freeze([this.delayMs]);
    }
}

class IsDisplayed extends Action {
    constructor() {
        super();
        Object.freeze(this);
    }

    execute(currentResult) {
        if (!currentResult) {
            return executeSuccess(currentResult);
        }

        if (Array.isArray(currentResult)) {
            const result = currentResult.filter(object => hasFormattingBox(object));
            return executeSuccess(Object.freeze(result));
        }

        const result = hasFormattingBox(currentResult) ? currentResult : null;
        return executeSuccess(result);
    }

    describe() {
        return `but only including elements which are displayed on the page`;
    }
}

class Check extends Action {
    constructor(callback) {
        if (typeof callback !== 'function') {
            throw Error('.check(callback): callback must be a function');
        }

        super();
        this.callback = callback;
        Object.freeze(this);
    }

    execute(currentResult) {
        if (!currentResult) {
            return executeSuccess(currentResult);
        }

        if (Array.isArray(currentResult)) {
            const result = currentResult.filter(object => this.callback(object));
            return executeSuccess(Object.freeze(result));
        }

        const result = this.callback(currentResult) ? currentResult : null;
        return executeSuccess(result);
    }

    describe() {
        return `but only including results that match a callback: \`${exports.describeCallback(this.callback)}\``;
    }
}

class ContainsText extends Action {
    constructor(text) {
        super();

        if (!text) {
            throw Error('.containsText(text): text must be a string or RegExp');
        }

        if (typeof text !== 'string' && !(typeof text.test === 'function' && typeof text.exec === 'function')) {
            throw Error('.containsText(text): text must be a string or RegExp');
        }

        this.text = text;
        Object.freeze(this);
    }

    execute(currentResult) {
        const test = resultItem => {
            const content = textContent(resultItem);
            return typeof this.text === 'string'
                ? content.indexOf(this.text) >= 0
                : this.text.test(content);
        };

        if (!currentResult) {
            return executeSuccess(currentResult);
        }

        if (Array.isArray(currentResult)) {
            const result = currentResult.filter(test);
            return executeSuccess(Object.freeze(result));
        }

        const result = test(currentResult) ? currentResult : null;
        return executeSuccess(result);
    }

    describe() {
        if (typeof this.text === 'string') {
            return `but only including results that contain the text: ${LEFT_QUOTE}${this.text}${RIGHT_QUOTE}`;
        }

        return `but only including results that contain text matching the regular expression: ${this.text}`;
    }
}

class First extends Action {
    constructor() {
        super();
        Object.freeze(this);
    }

    execute(currentResult) {
        if (Array.isArray(currentResult)) {
            const result = currentResult.length ? currentResult[0] : null;
            return executeSuccess(result);
        }
        return executeSuccess(currentResult);
    }

    describe() {
        return `but only returning the first result`;
    }
}

const DEFAULT_AMOUNT_ACTION = new Amount(1, Infinity);

exports.Action = Action;
exports.Noop = Noop;
exports.Target = Target;
exports.Amount = Amount;
exports.DEFAULT_AMOUNT_ACTION = DEFAULT_AMOUNT_ACTION;
exports.Selector = Selector;
exports.SelectorAll = SelectorAll;
exports.XPath = XPath;
exports.XPathAll = XPathAll;
exports.DocumentInteractive = DocumentInteractive;
exports.DocumentComplete = DocumentComplete;
exports.Delay = Delay;
exports.IsDisplayed = IsDisplayed;
exports.Check = Check;
exports.ContainsText = ContainsText;
exports.First = First;
