'use strict';

const ELEMENT_NODE = 1;
const XPATHRESULT_ORDERED_NODE_SNAPSHOT_TYPE = 7;
const XPATHRESULT_FIRST_ORDERED_NODE_TYPE = 9;

const dom = exports;
const getStringTag = object => Object.prototype.toString.call(object);

dom.findPropertyInChain = (object, name) => {
    let proto = Object.getPrototypeOf(object);
    while (proto) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name);
        if (descriptor) {
            return descriptor;
        }
        proto = Object.getPrototypeOf(proto);
    }
    return null;
};

/**
 * @param {*} object
 * @return {Boolean}
 */
dom.isDOMWindow = object => Boolean(
    object &&
    object.window === object &&
    object.self === object &&
    dom.isDOMDocument(object.document)
);

/**
 * @param {*} object
 * @return {Boolean} (window is not a Node)
 */
dom.isDOMNode = object => Boolean(
    object &&
    (typeof object === 'object' || typeof object === 'function') && // some nodes are typeof function
    'nodeType' in object &&
    'nodeName' in object &&
    'ownerDocument' in object &&
    'parentNode' in object
);

/**
 * @param {*} object
 * @return {Boolean}
 */
dom.isDOMDocument = object => Boolean(
    dom.isDOMNode(object) &&
    'defaultView' in object &&
    (getStringTag(object) === '[object HTMLDocument]' || getStringTag(object) === '[object Document]')
);

/**
 * @param {*} object
 * @return {Boolean}
 */
dom.isDOMElement = object => Boolean(
    dom.isDOMNode(object) &&
    (object.nodeType === ELEMENT_NODE || getStringTag(object) === '[object HTMLFormElement]') &&
    'tagName' in object
);

/**
 * @param {HTMLDocument} document
 * @return {?Window}
 */
dom.getDOMDocumentWindow = document => {
    const defaultView = dom.findPropertyInChain(document, 'defaultView');
    return defaultView.get.call(document);
};

/**
 * Is the given argument a valid result item as input/output to a wait `Expression`
 * @param {*} object
 * @return {boolean}
 */
dom.isResultItem = object => Boolean(
    dom.isDOMWindow(object) ||
    dom.isDOMDocument(object) ||
    dom.isDOMElement(object)
);

/**
 * @param {Window|Node} object
 * @return {Window}
 */
dom.resultItemToWindow = object => {
    if (dom.isDOMWindow(object)) {
        return object;
    }

    if (dom.isDOMDocument(object)) {
        return dom.getDOMDocumentWindow(object); // (might be null)
    }

    if (dom.isDOMNode(object)) {
        const ownerDocument = dom.findPropertyInChain(object, 'ownerDocument');
        return dom.getDOMDocumentWindow(ownerDocument.get.call(object));
    }

    throw Error('dom.resultItemToWindow(): Invalid argument');
};

/**
 * @param {Window|Node} object
 * @return {Document}
 */
dom.resultItemToDocument = object => {
    if (dom.isDOMWindow(object)) {
        return object.document;
    }

    if (dom.isDOMDocument(object)) {
        return object;
    }

    if (dom.isDOMNode(object)) {
        const ownerDocument = dom.findPropertyInChain(object, 'ownerDocument');
        return ownerDocument.get.call(object);
    }

    throw Error('dom.resultItemToDocument(): Invalid argument');
};

/**
 * @param {Window|Node} object
 * @return {?HTMLHtmlElement}
 */
dom.resultItemToDocumentElement = object => {
    const document = dom.resultItemToDocument(object);
    return dom.findPropertyInChain(document, 'documentElement').get.call(document);
};

/**
 * Find the closest object that implements the `ParentElement` interface, for the given result item
 * @param {Window|Node} object
 * @return {ParentElement} (A Document or an Element)
 */
dom.resultItemToParentNode = object => {
    if (dom.isDOMWindow(object)) {
        return object.document;
    }

    if (dom.isDOMDocument(object)) {
        return object;
    }

    if (dom.isDOMElement(object)) {
        return object;
    }

    throw Error('dom.resultItemToParentNode(): Invalid argument');
};

/**
 * Find the closest object that implements the `Element` interface, for the given result item
 * @param {Window|Node} object
 * @return {Element}
 */
dom.resultItemToElement = object => {
    if (dom.isDOMWindow(object) || dom.isDOMDocument(object)) {
        return dom.resultItemToDocumentElement(object);
    }

    if (dom.isDOMElement(object)) {
        return object;
    }

    throw Error('dom.resultItemToElement(): Invalid argument');
};

/**
 * @param {Window|Node} object
 * @return {string}
 */
dom.describeDOMObject = object => {
    if (object === undefined) {
        return '<#undefined>';
    }

    if (object === null) {
        return '<#null>';
    }

    if (dom.isDOMWindow(object)) {
        return '<#window>';
    }

    if (dom.isDOMDocument(object)) {
        return '<#document>';
    }

    if (getStringTag(object) === '[object HTMLFormElement]') {
        return '<form>';
    }

    if (dom.isDOMNode(object)) {
        return `<${object.nodeName.toLowerCase()}>`;
    }

    return '<???>';
};

/**
 * @param {Window|Node} resultItem
 * @param {string} expression
 * @return {?Element}
 */
dom.cssSelectorFirst = (resultItem, expression) => {
    const context = dom.resultItemToParentNode(resultItem);
    const querySelector = dom.findPropertyInChain(context, 'querySelector').value;
    return querySelector.call(context, expression);
};

/**
 * @param {Window|Node} resultItem
 * @param {string} expression
 * @return {Element[]}
 */
dom.cssSelectorArray = (resultItem, expression) => {
    const context = dom.resultItemToParentNode(resultItem);
    const querySelectorAll = dom.findPropertyInChain(context, 'querySelectorAll').value;
    return Array.from(querySelectorAll.call(context, expression));
};

/**
 * @param {Window|Node} resultItem
 * @param {string} expression
 * @return {?Element}
 */
dom.xpathFirst = (resultItem, expression) => {
    const document = dom.resultItemToDocument(resultItem);
    const context = dom.resultItemToParentNode(resultItem);
    const evaluate = dom.findPropertyInChain(document, 'evaluate').value;
    const xpathResult = evaluate.call(document, expression, context, null, XPATHRESULT_FIRST_ORDERED_NODE_TYPE, null);
    return xpathResult.singleNodeValue;
};

/**
 * @param {Window|Node} resultItem
 * @param {string} expression
 * @return {Element[]}
 */
dom.xpathArray = (resultItem, expression) => {
    const document = dom.resultItemToDocument(resultItem);
    const context = dom.resultItemToParentNode(resultItem);
    const evaluate = dom.findPropertyInChain(document, 'evaluate').value;
    const xpathResult = evaluate.call(document, expression, context, null, XPATHRESULT_ORDERED_NODE_SNAPSHOT_TYPE, null);

    const array = new Array(xpathResult.snapshotLength);
    for (let i = 0; i < array.length; ++i) {
        array[i] = xpathResult.snapshotItem(i);
    }

    return array;
};

/**
 * @param {HTMLDocument} document
 * @return {string} "loading" or "interactive" or "complete"
 */
dom.documentReadyState = document => {
    const readyState = dom.findPropertyInChain(document, 'readyState');
    return readyState.get.call(document);
};

dom.addEventListener = (object, ...args) => {
    if (dom.isDOMNode(object)) {
        const addEventListener = dom.findPropertyInChain(object, 'addEventListener');
        return addEventListener.value.apply(object, args);
    }

    // WindowProxy or something different
    return object.addEventListener(...args);
};

dom.removeEventListener = (object, ...args) => {
    if (dom.isDOMNode(object)) {
        const removeEventListener = dom.findPropertyInChain(object, 'removeEventListener');
        return removeEventListener.value.apply(object, args);
    }

    // WindowProxy or something different
    return object.removeEventListener(...args);
};

/**
 * @param {Element} element
 * @return {DOMRect}
 */
dom.getBoundingClientRect = element => {
    const getBoundingClientRect = dom.findPropertyInChain(element, 'getBoundingClientRect');
    return getBoundingClientRect.value.call(element);
};

/**
 * @param {Window|Node} object
 * @return {boolean}
 */
dom.hasFormattingBox = object => {
    const element = dom.resultItemToElement(object);
    const rect = dom.getBoundingClientRect(element);
    return rect.width > 0 && rect.height > 0;
};

/**
 * https://drafts.csswg.org/cssom/#escape-a-character-as-code-point
 * @param {Number} codePoint
 * @return {string}
 */
dom.cssEscapeAsCodePoint = codePoint => {
    return '\\' + codePoint.toString(16) + ' ';
};

/**
 * https://drafts.csswg.org/cssom/#serialize-an-identifier
 * @param {String} character
 * @param {Boolean} escapeNumber
 * @return {String}
 */
dom.cssSerializeIdentifierCharacter = (character, escapeNumber) => {
    const codeUnit = character.charCodeAt(0);

    // * If the character is NULL (U+0000), then the REPLACEMENT CHARACTER (U+FFFD).
    if (codeUnit === 0x0000) {
        return '\uFFFD';
    }

    // * If the character is in the range [\1-\1f] (U+0001 to U+001F) or is U+007F, then the character escaped as code point.
    if ((codeUnit >= 0x0001 && codeUnit <= 0x001F) || codeUnit === 0x007F) {
        return dom.cssEscapeAsCodePoint(codeUnit);
    }

    // * If the character is the first character and is in the range [0-9] (U+0030 to U+0039), then the character escaped as code point.
    // * If the character is the second character and is in the range [0-9] (U+0030 to U+0039) and the first character is a "-" (U+002D),
    //   then the character escaped as code point.
    if (escapeNumber && codeUnit >= 0x0030 && codeUnit <= 0x0039) {
        return dom.cssEscapeAsCodePoint(codeUnit);
    }

    // * If the character is not handled by one of the above rules and is greater than or equal to U+0080, is "-" (U+002D) or "_"
    //   (U+005F), or is in one of the ranges [0-9] (U+0030 to U+0039), [A-Z] (U+0041 to U+005A), or \[a-z] (U+0061 to U+007A), then the
    //   character itself.
    if (codeUnit >= 0x0080 ||
        codeUnit === 0x002D || // "-"
        codeUnit === 0x005F || // "_"
        (codeUnit >= 0x0030 && codeUnit <= 0x0039) || // 0-9
        (codeUnit >= 0x0041 && codeUnit <= 0x005A) || // A-Z
        (codeUnit >= 0x0061 && codeUnit <= 0x007A) // a-z
    ) {
        return character;
    }

    // * Otherwise, the escaped character.
    return '\\' + character;
};

/**
 * https://drafts.csswg.org/cssom/#serialize-an-identifier
 * @param {String} value
 * @return {String}
 */
dom.cssSerializeIdentifier = value => {
    const string = String(value);
    const length = string.length;

    let result = '';
    for (let index = 0; index < length; ++index) {
        const escapeNumber = index === 0 || (index === 1 && string[0] === '-');
        result += dom.cssSerializeIdentifierCharacter(string[index], escapeNumber);

    }
    return result;
};

/**
 * This is a tag function which performs CSS Identifier escaping on any value.
 *
 * @param {string[]} strings
 * @param {string[]} values
 * @return {*}
 */
dom.cssSelectorTag = (strings, ...values) => {
    let result = strings[0];
    for (let i = 1; i < strings.length; ++i) {
        result += dom.cssSerializeIdentifier(values[i - 1]);
        result += strings[i];
    }
    return result;
};

/**
 * @param {Window|Node} object
 * @return {string}
 */
dom.textContent = object => {
    const element = dom.resultItemToElement(object);
    const readyState = dom.findPropertyInChain(element, 'textContent');
    return readyState.get.call(element);
};
