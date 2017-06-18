'use strict';

const {describe, it, before} = require('mocha-sugar-free');
const {assert: {isNull, ok, strictEqual: eq, deepEqual, lengthOf, match}} = require('chai');
const jsdom = require('jsdom');

const result = require('../../lib/result');

const USE_JSDOM = !global.window;

describe('result', () => {
    let window;
    let document;

    before(() => {
        window = USE_JSDOM
            ? (new jsdom.JSDOM()).window
            : global.window;
        document = window.document;
    });

    describe('resultToArray()', () => {
        it('Should return an array as-is', () => {
            deepEqual(result.resultToArray([1, 2, 3]), [1, 2, 3]);
        });

        it('Should return an empty array for null or undefined', () => {
            deepEqual(result.resultToArray(null), []);
            deepEqual(result.resultToArray(undefined), []);
            ok(Array.isArray(result.resultToArray(null)));
            ok(Array.isArray(result.resultToArray(undefined)));
        });

        it('Should return an array of a single item for objects', () => {
            const obj = {foo: 123};
            const array = result.resultToArray(obj);
            ok(Array.isArray(array));
            lengthOf(array, 1);
            eq(array[0], obj);
        });
    });

    describe('resultCount()', () => {
        it('Should return the length of an array', () => {
            eq(result.resultCount([]), 0);
            eq(result.resultCount([1]), 1);
            eq(result.resultCount([1, 2, 3]), 3);
        });

        it('Should return 0 for null or undefined', () => {
            eq(result.resultCount(null), 0);
            eq(result.resultCount(undefined), 0);
        });

        it('Should return 1 for objects', () => {
            eq(result.resultCount({foo: 123}), 1);
        });
    });

    describe('buildStringFromTagValues()', () => {
        const foo = (strings, ...values) => [strings, values];

        it('Should build a string from the arguments of a tag string', () => {
            eq(result.buildStringFromTagValues(...foo``), '');
            eq(result.buildStringFromTagValues(...foo`foo`), 'foo');
            eq(result.buildStringFromTagValues(...foo`foo ${123}`), 'foo 123');
            eq(result.buildStringFromTagValues(...foo`foo ${123} bar`), 'foo 123 bar');
            eq(result.buildStringFromTagValues(...foo`foo ${123} bar ${456}`), 'foo 123 bar 456');
            eq(result.buildStringFromTagValues(...foo`${123} bar ${456} baz`), '123 bar 456 baz');
        });
    });

    describe('executeSuccess()', () => {
        it('Should return an object describing the status and value', () => {
            const value = {foo: 123};
            deepEqual(result.executeSuccess(value), {
                status: 'success',
                value: value,
            });
            eq(result.executeSuccess(value).value, value);
        });

        it('Should return a frozen object', () => {
            ok(Object.isFrozen(result.executeSuccess(null)));
        });
    });

    describe('executePendingTag()', () => {
        it('Should return an object describing the status and error reason', () => {
            deepEqual(result.executePendingTag`foo ${123} bar`, {
                status: 'pending',
                value: null,
                reasonStrings: ['foo ', ' bar'],
                reasonValues: [123],
            });
        });

        it('Should return a frozen object', () => {
            const obj = result.executePendingTag`foo ${123} bar`;
            ok(Object.isFrozen(obj));
            ok(Object.isFrozen(obj.reasonStrings));
            ok(Object.isFrozen(obj.reasonValues));
        });
    });

    describe('executeFatalFailureTag()', () => {
        it('Should return an object describing the status and error reason', () => {
            deepEqual(result.executeFatalFailureTag`foo ${123} bar`, {
                status: 'fatal failure',
                value: null,
                reasonStrings: ['foo ', ' bar'],
                reasonValues: [123],
            });
        });

        it('Should return a frozen object', () => {
            const obj = result.executeFatalFailureTag`foo ${123} bar`;
            ok(Object.isFrozen(obj));
            ok(Object.isFrozen(obj.reasonStrings));
            ok(Object.isFrozen(obj.reasonValues));
        });
    });

    describe('ResultWrapper', () => {
        describe('constructor', () => {
            it('Should intialize all properties to null', () => {
                const resultWrapper = new result.ResultWrapper();
                isNull(resultWrapper.value);
                isNull(resultWrapper.reasonStrings);
                isNull(resultWrapper.reasonValues);
                isNull(resultWrapper.errorObject);
                isNull(resultWrapper.lastResultStatus);
            });
        });

        describe('failureString()', () => {
            it('Should use reasonStrings and reasonValues if set', () => {
                const resultWrapper = new result.ResultWrapper();
                resultWrapper.reasonStrings = ['foo'];
                eq(resultWrapper.failureString(), 'foo');

                resultWrapper.reasonStrings = ['foo', 'bar'];
                resultWrapper.reasonValues = [123];
                eq(resultWrapper.failureString(), 'foo123bar');
            });

            it('Should use the message of the errorObject if set and reasonStrings is not set', () => {
                const resultWrapper = new result.ResultWrapper();
                resultWrapper.errorObject = Error('foo');
                eq(resultWrapper.failureString(), 'Error: foo');
            });

            it('Should return null if resultStrings and errorObject are not set', () => {
                const resultWrapper = new result.ResultWrapper();
                isNull(resultWrapper.failureString());
            });
        });

        describe('addDOMDocumentsToSet()', () => {
            it('Should do nothing if the value is null', () => {
                const resultWrapper = new result.ResultWrapper();
                const set = new Set([1, 2]);
                resultWrapper.addDOMDocumentsToSet(set);
                deepEqual([...set], [1, 2]);
            });

            it('Should add the document of a single result item', () => {
                const resultWrapper = new result.ResultWrapper();
                const set = new Set();
                resultWrapper.value = document.createElement('div');
                resultWrapper.addDOMDocumentsToSet(set);
                eq([...set][0], document);
            });

            it('Should add all document all result items', () => {
                const resultWrapper = new result.ResultWrapper();
                const set = new Set();
                const document2 = document.implementation.createHTMLDocument('');
                resultWrapper.value = [
                    window,
                    document,
                    document.createElement('p'),
                    document2.createElement('div'),
                ];
                resultWrapper.addDOMDocumentsToSet(set);
                eq(set.size, 2);
                eq([...set][0], document);
                eq([...set][1], document2);
            });
        });

        describe('runAction', () => {
            it('Should pass null as the first value', () => {
                const resultWrapper = new result.ResultWrapper();
                let executeValue;
                resultWrapper.runAction({
                    execute: value => {
                        executeValue = value;
                        return result.executeSuccess(null);
                    },
                });
                eq(resultWrapper.lastResultStatus, 'success');
                isNull(executeValue);
            });

            it('Should pass the value previously set', () => {
                const resultWrapper = new result.ResultWrapper();
                let executeValue;
                resultWrapper.value = document;
                resultWrapper.runAction({
                    execute: value => {
                        executeValue = value;
                        return result.executeSuccess(null);
                    },
                });
                eq(resultWrapper.lastResultStatus, 'success');
                eq(executeValue, document);
            });

            it('Should set the value if the return status is success', () => {
                const resultWrapper = new result.ResultWrapper();
                resultWrapper.value = document;
                resultWrapper.reasonStrings = ['foo'];
                resultWrapper.reasonValues = [123];
                resultWrapper.errorObject = Error('bla');

                const status = resultWrapper.runAction({
                    execute: doc => result.executeSuccess(doc.createElement('div')),
                });
                eq(status, 'success');
                eq(resultWrapper.lastResultStatus, 'success');
                eq(resultWrapper.value.nodeName, 'DIV');
                isNull(resultWrapper.reasonStrings);
                isNull(resultWrapper.reasonValues);
                isNull(resultWrapper.errorObject);

                const element1 = document.createElement('div');
                const element2 = document.createElement('p');
                const status2 = resultWrapper.runAction({
                    execute: doc => result.executeSuccess([element1, element2]),
                });
                eq(status2, 'success');
                eq(resultWrapper.lastResultStatus, 'success');
                ok(Array.isArray(resultWrapper.value));
                eq(resultWrapper.value[0], element1);
                eq(resultWrapper.value[1], element2);
                isNull(resultWrapper.reasonStrings);
                isNull(resultWrapper.reasonValues);
                isNull(resultWrapper.errorObject);
            });

            it('Should set the error descriptions if a pending status is returned', () => {
                const resultWrapper = new result.ResultWrapper();
                resultWrapper.value = document;
                const status = resultWrapper.runAction({
                    execute: value => result.executePendingTag`foo${123}bar`,
                });
                eq(status, 'pending');
                eq(resultWrapper.lastResultStatus, 'pending');
                isNull(resultWrapper.value);
                deepEqual(resultWrapper.reasonStrings, ['foo', 'bar']);
                deepEqual(resultWrapper.reasonValues, [123]);
                isNull(resultWrapper.errorObject);
            });

            it('Should set the error descriptions if a fatal error status is returned', () => {
                const resultWrapper = new result.ResultWrapper();
                resultWrapper.value = document;
                const status = resultWrapper.runAction({
                    execute: value => result.executeFatalFailureTag`foo${123}bar`,
                });
                eq(status, 'fatal failure');
                eq(resultWrapper.lastResultStatus, 'fatal failure');
                isNull(resultWrapper.value);
                deepEqual(resultWrapper.reasonStrings, ['foo', 'bar']);
                deepEqual(resultWrapper.reasonValues, [123]);
                isNull(resultWrapper.errorObject);
            });

            it('Should set the error descriptions and the status to fatal failure if an error is thrown', () => {
                const resultWrapper = new result.ResultWrapper();
                resultWrapper.value = document;
                resultWrapper.reasonStrings = ['foo'];
                resultWrapper.reasonValues = [123];
                const status = resultWrapper.runAction({
                    execute: value => {
                        throw Error('foo bar!');
                    },
                });
                eq(status, 'fatal failure');
                eq(resultWrapper.lastResultStatus, 'fatal failure');
                isNull(resultWrapper.value);
                isNull(resultWrapper.reasonStrings, ['foo', 'bar']);
                isNull(resultWrapper.reasonValues, [123]);
                eq(resultWrapper.errorObject.message, 'foo bar!');
            });

            it('Should set a fatal failure if an invalid status is returned', () => {
                const resultWrapper = new result.ResultWrapper();
                resultWrapper.value = document;
                resultWrapper.reasonStrings = ['foo'];
                resultWrapper.reasonValues = [123];
                const status = resultWrapper.runAction({
                    execute: value => ({status: 'foo'}),
                });
                eq(status, 'fatal failure');
                eq(resultWrapper.lastResultStatus, 'fatal failure');
                isNull(resultWrapper.value);
                isNull(resultWrapper.reasonStrings, ['foo', 'bar']);
                isNull(resultWrapper.reasonValues, [123]);
                match(resultWrapper.errorObject.message, /invalid.*status/i);
            });
        });
    });
});
