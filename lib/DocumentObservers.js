'use strict';
const DocumentObserver = require('./DocumentObserver');

class DocumentObservers {
    constructor() {
        // HTMLDocument -> DocumentObserver (a Window object is not used as the key
        // because the reference is reused between navigation, see WindowProxy in spec)
        this._documentToObserver = new WeakMap();
    }

    _getOrCreate(document) {
        let documentObserver = this._documentToObserver.get(document);
        if (!documentObserver) {
            documentObserver = new DocumentObserver(document);
            this._documentToObserver.set(document, documentObserver);
        }
        return documentObserver;
    }

    registerExecution(document, execution) {
        const documentObserver = this._getOrCreate(document);
        documentObserver.register(execution);
    }

    unregisterExecution(document, execution) {
        const documentObserver = this._documentToObserver.get(document);
        if (documentObserver) {
            documentObserver.unregister(execution);
        }
    }

    runAllChecks(document) {
        const documentObserver = this._documentToObserver.get(document);
        if (documentObserver) {
            documentObserver.runChecks();
        }
    }

    runAllChecksDeferred(document) {
        const documentObserver = this._documentToObserver.get(document);
        if (documentObserver) {
            documentObserver.runChecksDeferred();
        }
    }

    drainDeferrals(document) {
        const documentObserver = this._documentToObserver.get(document);
        if (documentObserver) {
            documentObserver.drainDeferrals();
        }
    }
}

module.exports = DocumentObservers;
