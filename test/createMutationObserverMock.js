'use strict';

const createMutationObserverMock = window => {
    window.mutationObserverMocks = [];

    class MutationObserverMock {
        constructor(callback) {
            this._observed = new Map();
            window.mutationObserverMocks.push(callback);
        }

        observe(target, options) {
            this._observed.set(target, options);
        }

        disconnect() {
            this._observed.clear();
        }
    }

    window.MutationObserver = MutationObserverMock;
    return MutationObserverMock;
};

module.exports = createMutationObserverMock;
