'use strict';

const {getDOMDocumentWindow, isDOMWindow, isDOMDocument, addEventListener, removeEventListener} = require('./dom');
const Timer = require('./Timer');

class DocumentObserver {
    constructor(document) {
        if (!isDOMDocument(document)) {
            throw Error('new DocumentObserver(document): Invalid argument `document`');
        }

        const window = getDOMDocumentWindow(document);
        if (!isDOMWindow(window)) {
            throw Error('new DocumentObserver(document): The given `document` must have a browsing context (a window)');
        }

        this.document = document;
        this.window = window;

        this._handleChange = this._handleChange.bind(this);
        this._handleChangeDeferred = this._handleChangeDeferred.bind(this);
        this._handleDeferrals = this._handleDeferrals.bind(this);

        // state:
        this._pendingExecutions = new Set();
        this._registeredListeners = false;
        this._mutationObserver = null;
        this._hasDeferredChange = false;
        this._removeListenersTimer = new Timer(0, () => this.removeListeners());

        // some checks are deferred, for two reasons:
        // 1. avoid running the checks too often
        // 2. wait for the other JS to complete whatever it is working on, in most cases this is the "moment" that we would like to measure
        this._deferralsTimer = new Timer(0, this._handleDeferrals);
    }

    get hasPendingExecutions() {
        return this._pendingExecutions.size > 0;
    }

    get hasRegisteredListeners() {
        return this._registeredListeners;
    }

    register(execution) {
        this._pendingExecutions.add(execution);
        this.registerListeners();
    }

    unregister(execution) {
        this._pendingExecutions.delete(execution);

        if (!this.hasPendingExecutions) {
            // defer the actual removal of the events, this avoids continuous the adding and removing of the event handlers in case
            // multiple wait expressions are run after one another, e.g.:
            // await bluefox.target(window).selector('foo'); await bluefox.target(window).selector('bar');
            this._removeListenersTimer.reschedule();
        }
    }

    registerListeners() {
        this._removeListenersTimer.cancel();

        if (this.hasRegisteredListeners) {
            return;
        }

        this._registeredListeners = true;
        const {window, document} = this;
        addEventListener(window, 'DOMContentLoaded', this._handleChange, true);
        addEventListener(window, 'load', this._handleChange, true);
        addEventListener(document, 'load', this._handleChangeDeferred, true); // e.g. <img>, <script src='"> load

        // 'error' fired at the `window` represents a JavaScript runtime error
        // 'error' events that bubble up to the `document` are resource error, such an <img> that fails to load
        addEventListener(document, 'error', this._handleChangeDeferred, true); // e.g. <img/> fails to load

        this._mutationObserver = new this.window.MutationObserver(this._handleChangeDeferred);
        this._mutationObserver.observe(document, {
            attributeOldValue: false,
            attributes: true,
            characterData: true,
            characterDataOldValue: false,
            childList: true,
            subtree: true,
        });
    }

    removeListeners() {
        if (!this.hasRegisteredListeners) {
            return;
        }

        const {window, document} = this;
        this._removeListenersTimer.cancel();
        removeEventListener(window, 'DOMContentLoaded', this._handleChange, true);
        removeEventListener(window, 'load', this._handleChange, true);
        removeEventListener(document, 'load', this._handleChangeDeferred, true);
        removeEventListener(document, 'error', this._handleChangeDeferred, true);
        this._mutationObserver.disconnect();
        this._mutationObserver = null;
        this._deferralsTimer.cancel();
        this._registeredListeners = false;
    }

    runChecks() {
        this._hasDeferredChange = false;
        this._deferralsTimer.cancel();

        for (const execution of this._pendingExecutions) {
            execution.check();
        }
    }

    runChecksDeferred() {
        this._hasDeferredChange = true;
        this._deferralsTimer.schedule();
    }

    drainDeferrals() {
        this._handleDeferrals();
    }

    _handleChange() {
        this.runChecks();
    }

    _handleChangeDeferred() {
        this._hasDeferredChange = true;
        this._deferralsTimer.schedule();
    }

    _handleDeferrals() {
        if (this._hasDeferredChange) {
            this._hasDeferredChange = false;
            this.runChecks();
        }
    }
}

module.exports = DocumentObserver;
