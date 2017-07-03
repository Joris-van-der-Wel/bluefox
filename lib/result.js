'use strict';
const {resultItemToDocument} = require('./dom');

const RESULT_STATUS_SUCCESS = 'success';
const RESULT_STATUS_PENDING = 'pending';
const RESULT_STATUS_FATAL_FAILURE = 'fatal failure';

exports.ResultWrapper = class ResultWrapper {
    constructor() {
        /** @type {?Node|Node[]} */
        this.value = null;
        /** @type {?string[]} */
        this.reasonStrings = null;
        /** @type {?Array} */
        this.reasonValues = null;
        /** @type {?Error} */
        this.errorObject = null;
        /** one of RESULT_STATUS_*
         * @type {?string}
         */
        this.lastResultStatus = null;
    }

    runAction(action, metaData) {
        try {
            const {status, value, reasonStrings, reasonValues} = action.execute(this.value, metaData);

            if (status !== RESULT_STATUS_SUCCESS && status !== RESULT_STATUS_PENDING && status !== RESULT_STATUS_FATAL_FAILURE) {
                throw Error('runAction: Invalid "status" value returned from action.execute()');
            }

            this.value = value;
            this.lastResultStatus = status;

            if (status === RESULT_STATUS_SUCCESS) {
                this.reasonStrings = null;
                this.reasonValues = null;
                this.errorObject = null;
                return this.lastResultStatus;
            }
            // status = pending / fatal failure

            this.reasonStrings = reasonStrings;
            this.reasonValues = reasonValues;
            return this.lastResultStatus;
        }
        catch (error) {
            this.value = null;
            this.reasonStrings = null;
            this.reasonValues = null;
            this.errorObject = error;
            this.lastResultStatus = RESULT_STATUS_FATAL_FAILURE;
            return this.lastResultStatus;
        }
    }

    addDOMDocumentsToSet(documents) {
        if (Array.isArray(this.value)) {
            for (const resultItem of this.value) {
                documents.add(resultItemToDocument(resultItem));
            }
        }
        else if (this.value) {
            documents.add(resultItemToDocument(this.value));
        }
    }

    failureString() {
        if (this.reasonStrings) {
            return exports.buildStringFromTagValues(this.reasonStrings, this.reasonValues);
        }

        if (this.errorObject) {
            return this.errorObject.toString();
        }

        return null;
    }

    getFailureError() {
        return this.errorObject
            ? this.errorObject
            : Error(this.failureString());
    }
};

exports.resultToArray = object => {
    if (Array.isArray(object)) {
        return object;
    }
    if (object === undefined || object === null) {
        return [];
    }
    return [object];
};

exports.resultCount = result => {
    if (Array.isArray(result)) {
        return result.length;
    }

    if (result === undefined || result === null) {
        return 0;
    }

    return 1;
};

exports.buildStringFromTagValues = (strings, values) => {
    let result = strings[0];
    for (let i = 1; i < strings.length; ++i) {
        result += String(values[i - 1]);
        result += strings[i];
    }
    return result;
};

/**
 * @param {?Window|Node|Array.<(Window|Node)>} value
 * @return {{status: string, value: (?Window|Node|Array.<(Window|Node)>)}}
 */
exports.executeSuccess = value => Object.freeze({
    status: RESULT_STATUS_SUCCESS,
    value,
});

/**
 * @param {string[]} strings
 * @param {...string} values
 * @return {{status: string, reasonStrings: string[], reasonValues: string[], value: null}}
 */
exports.executePendingTag = (strings, ...values) => Object.freeze({
    status: RESULT_STATUS_PENDING,
    // the descriptive string is only computed if the error is actually displayed
    reasonStrings: Object.freeze(strings),
    reasonValues: Object.freeze(values),
    value: null,
});

/**
 * @param {string[]} strings
 * @param {...string} values
 * @return {{status: string, reasonStrings: string[], reasonValues: string[], value: null}}
 */
exports.executeFatalFailureTag = (strings, ...values) => Object.freeze({
    status: RESULT_STATUS_FATAL_FAILURE,
    // the descriptive string is only computed if the error is actually displayed
    reasonStrings: Object.freeze(strings),
    reasonValues: Object.freeze(values),
    value: null,
});

exports.RESULT_STATUS_SUCCESS = RESULT_STATUS_SUCCESS;
exports.RESULT_STATUS_PENDING = RESULT_STATUS_PENDING;
exports.RESULT_STATUS_FATAL_FAILURE = RESULT_STATUS_FATAL_FAILURE;
