'use strict';

const {describe, it, before, beforeEach, afterEach} = require('mocha-sugar-free');
const {assert: {isFalse, isTrue, isNull, ok, throws, strictEqual: eq, lengthOf, deepEqual}} = require('chai');
const jsdom = require('jsdom');

const dom = require('../../lib/dom');

const USE_JSDOM = !global.window;

describe('dom utility', () => {
    let window;
    let document;

    before(() => {
        window = USE_JSDOM
            ? (new jsdom.JSDOM()).window
            : global.window;
        document = window.document;
    });

    describe('findPropertyInChain', () => {
        class Foo {}
        class Bar extends Foo {}
        Foo.prototype.foo = 'FOO';
        Bar.prototype.bar = 'BAR';

        it('Should ', () => {
            const bar = new Bar();
            eq(dom.findPropertyInChain(bar, 'foo').value, 'FOO');
            eq(dom.findPropertyInChain(bar, 'bar').value, 'BAR');

            bar.foo = 'X';
            bar.bar = 'X';
            eq(dom.findPropertyInChain(bar, 'foo').value, 'FOO');
            eq(dom.findPropertyInChain(bar, 'bar').value, 'BAR');

            const foo = new Foo();
            eq(dom.findPropertyInChain(foo, 'foo').value, 'FOO');
            isNull(dom.findPropertyInChain(foo, 'bar'));

            foo.foo = 'X';
            foo.bar = 'X';
            eq(dom.findPropertyInChain(foo, 'foo').value, 'FOO');
            isNull(dom.findPropertyInChain(foo, 'bar'));
        });
    });

    describe('isDOMWindow', () => {
        it('should match a WindowProxy object', () => {
            isTrue(dom.isDOMWindow(window));
        });

        it('should not match DOM Nodes', () => {
            isFalse(dom.isDOMWindow(document));
            isFalse(dom.isDOMWindow(document.createElement('div')));
            isFalse(dom.isDOMWindow(document.createElement('form')));
            isFalse(dom.isDOMWindow(document.createTextNode('foo')));
            isFalse(dom.isDOMWindow(document.createDocumentFragment()));
            isFalse(dom.isDOMWindow(document.createComment('foo')));
            isFalse(dom.isDOMWindow(document.doctype));
            if (document.implementation && document.implementation.createDocument) {
                isFalse(dom.isDOMWindow(document.implementation.createDocument(null, 'bar', null)), 'should not match XmlDocument');
            }
        });

        it('should not match invalid types', () => {
            isFalse(dom.isDOMWindow(null));
            isFalse(dom.isDOMWindow(undefined));
            isFalse(dom.isDOMWindow({}));
            isFalse(dom.isDOMWindow(123));
            isFalse(dom.isDOMWindow('foo'));
            isFalse(dom.isDOMWindow(Symbol()));
        });
    });

    describe('isDOMNode', () => {
        it('should match all types of dom nodes', () => {
            isTrue(dom.isDOMNode(window.document));
            isTrue(dom.isDOMNode(document.createElement('div')));
            isTrue(dom.isDOMNode(document.createElement('form')));
            isTrue(dom.isDOMNode(document.createTextNode('foo')));
            isTrue(dom.isDOMNode(document.createDocumentFragment()));
            isTrue(dom.isDOMNode(document.createComment('foo')));
        });

        it('should match all types of dom nodes (jsdom spec violation)', {skip: USE_JSDOM}, () => {
            const element = document.createElement('div');
            element.setAttribute('class', 'foo');
            isTrue(dom.isDOMNode(element.getAttributeNode('class')));
            isTrue(dom.isDOMNode(document.doctype));
        });

        it('should not match WindowProxy', () => {
            isFalse(dom.isDOMNode(window));
        });

        it('should not match invalid types', () => {
            isFalse(dom.isDOMNode(null));
            isFalse(dom.isDOMNode(undefined));
            isFalse(dom.isDOMNode({}));
            isFalse(dom.isDOMNode(123));
            isFalse(dom.isDOMNode('foo'));
            isFalse(dom.isDOMNode(Symbol()));
        });
    });

    describe('isDOMDocument', () => {
        it('should match a HTMLDocument object', () => {
            isTrue(dom.isDOMDocument(document));
        });

        it('should not match WindowProxy or non document DOM Nodes', () => {
            isFalse(dom.isDOMDocument(window));
            isFalse(dom.isDOMDocument(document.createElement('div')));
            isFalse(dom.isDOMDocument(document.createElement('form')));
            isFalse(dom.isDOMDocument(document.createTextNode('foo')));
            isFalse(dom.isDOMDocument(document.createDocumentFragment()));
            isFalse(dom.isDOMDocument(document.createComment('foo')));
            isFalse(dom.isDOMDocument(document.doctype));
        });

        it('should not match WindowProxy or non document DOM Nodes (jsdom spec violation)', {skip: USE_JSDOM}, () => {
            if (document.implementation && document.implementation.createDocument) {
                isFalse(dom.isDOMDocument(document.implementation.createDocument(null, 'bar', null)), 'should not match XmlDocument');
            }
        });

        it('should not match invalid types', () => {
            isFalse(dom.isDOMDocument(null));
            isFalse(dom.isDOMDocument(undefined));
            isFalse(dom.isDOMDocument({}));
            isFalse(dom.isDOMDocument(123));
            isFalse(dom.isDOMDocument('foo'));
            isFalse(dom.isDOMDocument(Symbol()));
        });
    });

    describe('isDOMElement', () => {
        it('should match element nodes', () => {
            isTrue(dom.isDOMElement(document.createElement('div')));
            isTrue(dom.isDOMElement(document.createElement('span')));
            isTrue(dom.isDOMElement(document.createElement('foobar')));
        });

        it('should match a form element with overridden builtins', () => {
            const form = document.createElement('form');
            form.innerHTML = `
                <input name="tagName">
                <input name="nodeType">
                <input name="nodeName">
            `;
            isTrue(dom.isDOMElement(form));
        });

        it('should not match WindowProxy or non element DOM Nodes', () => {
            isFalse(dom.isDOMElement(window));
            isFalse(dom.isDOMElement(document));
            isFalse(dom.isDOMElement(document.createTextNode('foo')));
            isFalse(dom.isDOMElement(document.createDocumentFragment()));
            isFalse(dom.isDOMElement(document.createComment('foo')));
            isFalse(dom.isDOMElement(document.doctype));
            if (document.implementation && document.implementation.createDocument) {
                isFalse(dom.isDOMElement(document.implementation.createDocument(null, 'bar', null)), 'should not match XmlDocument');
            }
        });

        it('should not match invalid types', () => {
            isFalse(dom.isDOMElement(null));
            isFalse(dom.isDOMElement(undefined));
            isFalse(dom.isDOMElement({}));
            isFalse(dom.isDOMElement(123));
            isFalse(dom.isDOMElement('foo'));
            isFalse(dom.isDOMElement(Symbol()));
        });
    });

    describe('getDOMDocumentWindow', () => {
        it('should get the defaultView of a document, even if it has been overridden', () => {
            ok(dom.getDOMDocumentWindow(document) === window);

            const img = document.createElement('img');
            img.setAttribute('name', 'defaultView');
            try {
                document.body.appendChild(img);
                ok(dom.getDOMDocumentWindow(document) === window);
            }
            finally {
                document.body.removeChild(img);
            }
        });
    });

    describe('isResultItem', () => {
        it('should match a WindowProxy, HTMLDocument or element', () => {
            isTrue(dom.isResultItem(window));
            isTrue(dom.isResultItem(document));
            isTrue(dom.isResultItem(document.createElement('div')));
        });

        it('should not match non element or non document nodes', () => {
            isFalse(dom.isResultItem(document.createTextNode('foo')));
            isFalse(dom.isResultItem(document.createDocumentFragment()));
            isFalse(dom.isResultItem(document.createComment('foo')));
        });

        it('should not match invalid types', () => {
            isFalse(dom.isResultItem(null));
            isFalse(dom.isResultItem(undefined));
            isFalse(dom.isResultItem({}));
            isFalse(dom.isResultItem(123));
            isFalse(dom.isResultItem('foo'));
            isFalse(dom.isResultItem(Symbol()));
        });
    });

    describe('resultItemToWindow', () => {
        it('should return the same WindowProxy if a WindowProxy is passed', () => {
            ok(dom.resultItemToWindow(window) === window);
        });

        it('should return the defaultView of dom nodes', () => {
            ok(dom.resultItemToWindow(document) === window);
            ok(dom.resultItemToWindow(document.createElement('div')) === window);
        });

        it('should throw for invalid types', () => {
            throws(() => dom.resultItemToWindow(), /resultItemToWindow.*invalid.*argument/i);
            throws(() => dom.resultItemToWindow(null), /resultItemToWindow.*invalid.*argument/i);
            throws(() => dom.resultItemToWindow(123), /resultItemToWindow.*invalid.*argument/i);
            throws(() => dom.resultItemToWindow('foo'), /resultItemToWindow.*invalid.*argument/i);
        });
    });

    describe('resultItemToDocument', () => {
        it('should return the same HTMLDocument if a HTMLDocument is passed', () => {
            ok(dom.resultItemToDocument(document) === document);
        });

        it('should return the active document of a WindowProxy', () => {
            ok(dom.resultItemToDocument(window) === document);
        });

        it('should return the ownerDocument of dom nodes', () => {
            ok(dom.resultItemToDocument(document.createElement('div')) === document);
        });

        it('should throw for invalid types', () => {
            throws(() => dom.resultItemToDocument(), /resultItemToDocument.*invalid.*argument/i);
            throws(() => dom.resultItemToDocument(null), /resultItemToDocument.*invalid.*argument/i);
            throws(() => dom.resultItemToDocument(123), /resultItemToDocument.*invalid.*argument/i);
            throws(() => dom.resultItemToDocument('foo'), /resultItemToDocument.*invalid.*argument/i);
        });
    });

    describe('resultItemToDocumentElement', () => {
        it('should return the root element if a HTMLDocument is passed', () => {
            ok(dom.resultItemToDocumentElement(document) === document.documentElement);
        });

        it('should return the root element of the active document of a WindowProxy', () => {
            ok(dom.resultItemToDocumentElement(window) === document.documentElement);
        });

        it('should return the root element of the ownerDocument of dom nodes', () => {
            ok(dom.resultItemToDocumentElement(document.createElement('div')) === document.documentElement);
        });

        it('should throw for invalid types', () => {
            throws(() => dom.resultItemToDocumentElement(), /resultItemToDocument.*invalid.*argument/i);
            throws(() => dom.resultItemToDocumentElement(null), /resultItemToDocument.*invalid.*argument/i);
            throws(() => dom.resultItemToDocumentElement(123), /resultItemToDocument.*invalid.*argument/i);
            throws(() => dom.resultItemToDocumentElement('foo'), /resultItemToDocument.*invalid.*argument/i);
        });
    });

    describe('resultItemToParentNode', () => {
        it('should return the same HTMLDocument if a HTMLDocument is passed', () => {
            ok(dom.resultItemToParentNode(document) === document);
        });

        it('should return the same Element if an Element is passed', () => {
            const element = document.createElement('div');
            ok(dom.resultItemToParentNode(element) === element);
        });

        it('should return the active document of a WindowProxy', () => {
            ok(dom.resultItemToParentNode(window) === document);
        });

        it('should throw for invalid types', () => {
            throws(() => dom.resultItemToParentNode(document.createTextNode('bla')), /resultItemToParentNode.*invalid.*argument/i);
            throws(() => dom.resultItemToParentNode(), /resultItemToParentNode.*invalid.*argument/i);
            throws(() => dom.resultItemToParentNode(null), /resultItemToParentNode.*invalid.*argument/i);
            throws(() => dom.resultItemToParentNode(123), /resultItemToParentNode.*invalid.*argument/i);
            throws(() => dom.resultItemToParentNode('foo'), /resultItemToParentNode.*invalid.*argument/i);
        });
    });

    describe('resultItemToElement', () => {
        it('should return the root element if a HTMLDocument is passed', () => {
            ok(dom.resultItemToElement(document) === document.documentElement);
        });

        it('should return the same Element if an Element is passed', () => {
            const element = document.createElement('div');
            ok(dom.resultItemToElement(element) === element);
            ok(dom.resultItemToElement(document.documentElement) === document.documentElement);
        });

        it('should return the root element of the active document of a WindowProxy', () => {
            ok(dom.resultItemToElement(window) === document.documentElement);
        });

        it('should throw for invalid types', () => {
            throws(() => dom.resultItemToElement(document.createTextNode('bla')), /resultItemToElement.*invalid.*argument/i);
            throws(() => dom.resultItemToElement(), /resultItemToElement.*invalid.*argument/i);
            throws(() => dom.resultItemToElement(null), /resultItemToElement.*invalid.*argument/i);
            throws(() => dom.resultItemToElement(123), /resultItemToElement.*invalid.*argument/i);
            throws(() => dom.resultItemToElement('foo'), /resultItemToElement.*invalid.*argument/i);
        });
    });

    describe('describeDOMObject', () => {
        it('should return a short string representation of dom or window objects', () => {
            eq(dom.describeDOMObject(undefined), '<#undefined>');
            eq(dom.describeDOMObject(null), '<#null>');
            eq(dom.describeDOMObject(document), '<#document>');
            eq(dom.describeDOMObject(window), '<#window>');
            eq(dom.describeDOMObject(document.createElement('div')), '<div>');
            eq(dom.describeDOMObject(document.createElement('DIV')), '<div>');
            eq(dom.describeDOMObject(document.createTextNode('foo')), '<#text>');
            eq(dom.describeDOMObject({}), '<???>');
            const form = document.createElement('form');
            eq(dom.describeDOMObject(form), '<form>');
            form.innerHTML = `
                <input name="tagName">
                <input name="nodeType">
                <input name="nodeName">
            `;
            eq(dom.describeDOMObject(form), '<form>');
        });
    });

    describe('cssSelectorFirst', () => {
        let fooElement;

        beforeEach(() => {
            fooElement = document.createElement('div');
            fooElement.id = 'foo';
            document.body.appendChild(fooElement);
        });

        afterEach(() => {
            document.body.removeChild(fooElement);
            fooElement = null;
        });

        it('Should use querySelector() on the active document if a WindowProxy is passed', () => {
            ok(dom.cssSelectorFirst(window, '#foo') === fooElement);
        });

        it('Should use querySelector() on the given object if a document or element is passed', () => {
            ok(dom.cssSelectorFirst(document, 'html') === document.documentElement);
            ok(dom.cssSelectorFirst(document.documentElement, 'html') === null);
            ok(dom.cssSelectorFirst(document, '#foo') === fooElement);
            ok(dom.cssSelectorFirst(document.body, '#foo') === fooElement);
            ok(dom.cssSelectorFirst(fooElement, '#foo') === null);
        });

        it('Should use the proper querySelector() even if it has been overridden', () => {
            fooElement.innerHTML = `
                <img name="querySelector">
                <form>
                    <input name="querySelector">
                    <div id="bar"/>
                </form>
            `;
            const bar = document.getElementById('bar');
            ok(Boolean(bar));

            ok(dom.cssSelectorFirst(document, '#bar') === bar);
            ok(dom.cssSelectorFirst(dom.cssSelectorFirst(document, 'form'), '#bar') === bar);
        });
    });

    describe('cssSelectorArray', () => {
        let fooElement;

        beforeEach(() => {
            fooElement = document.createElement('div');
            fooElement.id = 'foo';
            document.body.appendChild(fooElement);
            fooElement.innerHTML = `
                <p>foo</p>
                <p>foo</p>
                <p>bar</p>
                <p>bar</p>
                <p>bar</p>
            `;
        });

        afterEach(() => {
            document.body.removeChild(fooElement);
            fooElement = null;
        });

        it('Should use querySelectorAll() on the active document if a WindowProxy is passed', () => {
            const elements = dom.cssSelectorArray(window, 'p');
            ok(Array.isArray(elements));
            lengthOf(elements, 5);
        });

        it('Should use querySelectorAll() on the given object if a document or element is passed', () => {
            deepEqual(dom.cssSelectorArray(document, 'html'), [document.documentElement]);
            deepEqual(dom.cssSelectorArray(document.documentElement, 'html'), []);
            ok(Array.isArray(dom.cssSelectorArray(document.documentElement, 'html')));
            deepEqual(dom.cssSelectorArray(document, '#foo > p'), Array.from(fooElement.children));
            deepEqual(dom.cssSelectorArray(document.body, '#foo > p'), Array.from(fooElement.children));
            deepEqual(dom.cssSelectorArray(fooElement, '#foo'), []);
        });

        it('Should use the proper querySelectorAll() even if it has been overridden', () => {
            fooElement.innerHTML = `
                <img name="querySelectorAll">
                <form>
                    <input name="querySelectorAll">
                    <div id="bar"/>
                </form>
            `;
            const bar = document.getElementById('bar');
            ok(Boolean(bar));

            deepEqual(dom.cssSelectorArray(document, '#bar'), [bar]);
            deepEqual(dom.cssSelectorArray(dom.cssSelectorFirst(document, 'form'), '#bar'), [bar]);
        });
    });

    describe('xpathFirst', () => {
        let fooElement;

        beforeEach(() => {
            fooElement = document.createElement('div');
            fooElement.id = 'foo';
            document.body.appendChild(fooElement);
        });

        afterEach(() => {
            document.body.removeChild(fooElement);
            fooElement = null;
        });

        it('Should use the active document as the context for document.evaluate() if a WindowProxy is passed', () => {
            ok(dom.xpathFirst(window, './/*[@id="foo"]') === fooElement);
        });

        it('Should use the given object as the context for document.evaluate() if a document or element is passed', () => {
            ok(dom.xpathFirst(document, './/html') === document.documentElement);
            ok(dom.xpathFirst(document.documentElement, './/html') === null);
            ok(dom.xpathFirst(document, './/*[@id="foo"]') === fooElement);
            ok(dom.xpathFirst(document.body, './/*[@id="foo"]') === fooElement);
            ok(dom.xpathFirst(fooElement, './/*[@id="foo"]') === null);
        });

        it('Should use the proper evaluate() even if it has been overridden', () => {
            fooElement.innerHTML = `
                <img name="evaluate">
            `;
            ok(dom.xpathFirst(document, './/*[@id="foo"]') === fooElement);
        });
    });

    describe('xpathArray', () => {
        let fooElement;

        beforeEach(() => {
            fooElement = document.createElement('div');
            fooElement.id = 'foo';
            document.body.appendChild(fooElement);
            fooElement.innerHTML = `
                <p>foo</p>
                <p>foo</p>
                <p>bar</p>
                <p>bar</p>
                <p>bar</p>
            `;
        });

        afterEach(() => {
            document.body.removeChild(fooElement);
            fooElement = null;
        });

        it('Should use the active document as the context for document.evaluate() if a WindowProxy is passed', () => {
            const elements = dom.xpathArray(window, './/p');
            ok(Array.isArray(elements));
            lengthOf(elements, 5);
        });

        it('Should use the given object as the context for document.evaluate() if a document or element is passed', () => {
            deepEqual(dom.xpathArray(document, './/html'), [document.documentElement]);
            deepEqual(dom.xpathArray(document.documentElement, './/html'), []);
            ok(Array.isArray(dom.xpathArray(document.documentElement, './/html')));
            deepEqual(dom.xpathArray(document, './/*[@id="foo"]/p'), Array.from(fooElement.children));
            deepEqual(dom.xpathArray(document.body, './/*[@id="foo"]/p'), Array.from(fooElement.children));
            deepEqual(dom.xpathArray(fooElement, './/*[@id="foo"]'), []);
        });

        it('Should use the proper evaluate() even if it has been overridden', () => {
            fooElement.innerHTML = `
                <img name="evaluate">
            `;
            deepEqual(dom.xpathArray(document, './/*[@id="foo"]'), [fooElement]);
        });
    });

    describe('documentReadyState', () => {
        // the other states (loading & interactive) are tested in integration tests
        it('should equal "complete"', () => {
            deepEqual(dom.documentReadyState(document), 'complete');
        });

        it('should equal "complete" even if readyState has been overridden', () => {
            const img = document.createElement('img');
            img.setAttribute('name', 'readyState');
            try {
                document.body.appendChild(img);
                ok(dom.documentReadyState(document) === 'complete');
            }
            finally {
                document.body.removeChild(img);
            }
        });
    });

    describe('addEventListener & removeEventListener', () => {
        let called;
        let dispatchedCurrentTarget;
        let dispatchedThis;

        const handler = function (e) {
            ++called;
            dispatchedCurrentTarget = e.currentTarget;
            dispatchedThis = this;
        };

        beforeEach(() => {
            called = 0;
            dispatchedCurrentTarget = null;
            dispatchedThis = null;
        });

        it('should call the proper function if a WindowProxy is passed', () => {
            dom.addEventListener(window, 'foo', handler);
            try {
                eq(called, 0);
                document.body.dispatchEvent(new window.Event('foo', {bubbles: true}));
                eq(called, 1);
                ok(dispatchedCurrentTarget === window);
                if (!USE_JSDOM) { // jsdom bug
                    ok(dispatchedThis === window);
                }
            }
            finally {
                dom.removeEventListener(window, 'foo', handler);
            }
            document.body.dispatchEvent(new window.Event('foo', {bubbles: true}));
            eq(called, 1);
        });

        it('should call the proper function if a HTMLDocument is passed', () => {
            dom.addEventListener(document, 'foo', handler);
            try {
                eq(called, 0);
                document.body.dispatchEvent(new window.Event('foo', {bubbles: true}));
                eq(called, 1);
                ok(dispatchedCurrentTarget === document);
                ok(dispatchedThis === document);
            }
            finally {
                dom.removeEventListener(document, 'foo', handler);
            }
            document.body.dispatchEvent(new window.Event('foo', {bubbles: true}));
            eq(called, 1);
        });

        it('should call the proper function if an Element is passed', () => {
            dom.addEventListener(document.body, 'foo', handler);
            try {
                eq(called, 0);
                document.body.dispatchEvent(new window.Event('foo', {bubbles: true}));
                eq(called, 1);
                ok(dispatchedCurrentTarget === document.body);
                ok(dispatchedThis === document.body);
            }
            finally {
                dom.removeEventListener(document.body, 'foo', handler);
            }
            document.body.dispatchEvent(new window.Event('foo', {bubbles: true}));
            eq(called, 1);
        });

        it('should call the proper function if a HTMLDocument is passed, even if it is overridden', () => {
            const img = document.createElement('img');
            img.setAttribute('name', 'addEventListener');
            const img2 = document.createElement('img');
            img2.setAttribute('name', 'removeEventListener');
            try {
                document.body.appendChild(img);
                document.body.appendChild(img2);

                dom.addEventListener(document, 'foo', handler);
                try {
                    eq(called, 0);
                    document.body.dispatchEvent(new window.Event('foo', {bubbles: true}));
                    eq(called, 1);
                    ok(dispatchedCurrentTarget === document);
                    ok(dispatchedThis === document);
                }
                finally {
                    dom.removeEventListener(document, 'foo', handler);
                }
                document.body.dispatchEvent(new window.Event('foo', {bubbles: true}));
                eq(called, 1);
            }
            finally {
                document.body.removeChild(img);
                document.body.removeChild(img2);
            }
        });

        it('should call the proper function if a HTMLFormElement is passed, even if it is overridden', () => {
            const form = document.createElement('form');
            form.innerHTML = `<input name="addEventListener"><input name="removeEventListener">`;
            try {
                document.body.appendChild(form);

                dom.addEventListener(form, 'foo', handler);
                try {
                    eq(called, 0);
                    form.dispatchEvent(new window.Event('foo', {bubbles: true}));
                    eq(called, 1);
                    ok(dispatchedCurrentTarget === form);
                    ok(dispatchedThis === form);
                }
                finally {
                    dom.removeEventListener(form, 'foo', handler);
                }
                document.body.dispatchEvent(new window.Event('foo', {bubbles: true}));
                eq(called, 1);
            }
            finally {
                document.body.removeChild(form);
            }
        });
    });

    describe('getBoundingClientRect', () => {
        it('Should call the DOM method getBoundingClientRect()', () => {
            const element = document.createElement('div');
            deepEqual(dom.getBoundingClientRect(element), element.getBoundingClientRect());
        });
    });

    describe('hasFormattingBox', () => {
        describe('[jsdom]', {skip: !USE_JSDOM}, () => {
            const override = obj => {
                Object.freeze(obj);
                window.HTMLDivElement.prototype.getBoundingClientRect = () => obj;
            };

            afterEach(() => {
                delete window.HTMLDivElement.prototype.getBoundingClientRect;
            });

            it('Should return true if the given result item has a formatting box that is larger than 0x0', () => {
                override({x: 0, y: -4279, width: 1905, height: 481, top: -4279, right: 1905, bottom: -3798, left: 0});
                isTrue(dom.hasFormattingBox(document.createElement('div')));

                override({x: 0, y: 0, width: 1, height: 1, top: 0, right: 1, bottom: 1, left: 0});
                isTrue(dom.hasFormattingBox(document.createElement('div')));

                override({x: 0, y: 0, width: 0.0001, height: 0.0001, top: 0, right: 0.0001, bottom: 0.0001, left: 0});
                isTrue(dom.hasFormattingBox(document.createElement('div')));
            });

            it('Should return false if the given result item has no formatting box', () => {
                override({x: 0, y: 0, width: 0, height: 1, top: 0, right: 0, bottom: 1, left: 0});
                isFalse(dom.hasFormattingBox(document.createElement('div')));

                override({x: 0, y: 0, width: 1, height: 0, top: 0, right: 1, bottom: 0, left: 0});
                isFalse(dom.hasFormattingBox(document.createElement('div')));

                override({x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0});
                isFalse(dom.hasFormattingBox(document.createElement('div')));
            });
        });

        describe('[not jsdom]', {skip: USE_JSDOM}, () => {
            let element;

            beforeEach(() => {
                element = document.createElement('div');
                document.body.appendChild(element);
            });

            afterEach(() => {
                element.remove();
                element = null;
            });

            it('Should return true for WindowProxy', () => {
                isTrue(dom.hasFormattingBox(window));
            });

            it('Should return true for HTMLDocument', () => {
                isTrue(dom.hasFormattingBox(document));
            });

            it('Should return true if the given result item has a formatting box that is larger than 0x0', () => {
                element.style = 'width: 100px; height: 150px;';
                isTrue(dom.hasFormattingBox(element));

                element.style = 'width: 1px; height: 1px;';
                isTrue(dom.hasFormattingBox(element));

                // visibility: hidden still affects the layout of the page
                element.style = 'width: 100px; height: 150px; visibility: hidden;';
                isTrue(dom.hasFormattingBox(element));
            });

            it('Should return false if the given result item is not part of the page', () => {
                const disconnectedElement = document.createElement('div');
                disconnectedElement.style = 'width: 100px; height: 150px;';
                isFalse(dom.hasFormattingBox(disconnectedElement));
            });

            it('Should return false if the given result item has no formatting box', () => {
                isFalse(dom.hasFormattingBox(element));

                element.style = 'width: 0; height: 1px;';
                isFalse(dom.hasFormattingBox(element));

                element.style = 'width: 1px; height: 0;';
                isFalse(dom.hasFormattingBox(element));

                element.style = 'width: 100px; height: 150px; display: none;';
                isFalse(dom.hasFormattingBox(element));
            });
        });
    });

    describe('cssSerializeIdentifier', () => {
        it('Should implement all characters per CSSOM ', () => {
            const inputArray = new Array(0x100).fill(0).map((_, index) => index);
            const input = String.fromCharCode(...inputArray);

            const output = '�\\1 \\2 \\3 \\4 \\5 \\6 \\7 \\8 \\9 \\a \\b \\c \\d \\e \\f \\10 \\11 \\12 \\13 \\14 \\15 \\16 \\17 \\18' +
                ' \\19 \\1a \\1b \\1c \\1d \\1e \\1f \\ \\!\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,-\\.\\/0123456789\\:\\;\\<\\=\\>\\?\\@ABC' +
                'DEFGHIJKLMNOPQRSTUVWXYZ\\[\\\\\\]\\^_\\`abcdefghijklmnopqrstuvwxyz\\{\\|\\}\\~\\7f \xa0¡' +
                '¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ';

            eq(dom.cssSerializeIdentifier(input), output);
        });

        it('Should escape numbers at the start of the string per CSSOM', () => {
            eq(dom.cssSerializeIdentifier('0'), '\\30 ');
            eq(dom.cssSerializeIdentifier('5'), '\\35 ');
            eq(dom.cssSerializeIdentifier('-5'), '-\\35 ');
            eq(dom.cssSerializeIdentifier('12345'), '\\31 2345');
            eq(dom.cssSerializeIdentifier('-12345'), '-\\31 2345');
        });
    });

    describe('cssSelectorTag', () => {
        it('Should construct a CSS Selector with escaping', () => {
            const foo = '-1234 "bar" #:.';
            const bar = '"bar" #:.';
            eq(dom.cssSelectorTag`a[href=${foo}], #${bar}`, 'a[href=-\\31 234\\ \\"bar\\"\\ \\#\\:\\.], #\\"bar\\"\\ \\#\\:\\.');
        });
    });

    describe('textContent', () => {
        it('Should return the textContent of an element', () => {
            const foo = document.createElement('div');
            foo.textContent = 'FOO123!';
            eq(dom.textContent(foo), 'FOO123!');
        });

        it('Should return the textContent of the html element if a HTMLDocument or WindowProxy is passed', () => {
            const foo = document.createElement('div');
            foo.textContent = 'FOO123!';
            document.body.appendChild(foo);
            try {
                eq(dom.textContent(window), document.documentElement.textContent);
                eq(dom.textContent(document), document.documentElement.textContent);
            }
            finally {
                foo.remove();
            }
        });

        it('Should return the textContent of a form element even if the property is overridden', () => {
            const form = document.createElement('form');
            form.innerHTML = `<input name="textContent" type="text">Hello!!`;
            eq(dom.textContent(form), 'Hello!!');
        });
    });
});
