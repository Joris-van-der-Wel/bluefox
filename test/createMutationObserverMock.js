'use strict';

const createMutationObserverMock = window => {
    window.mutationObserverMocks = [];

    let callbacksPending = false;
    window.mutationObserverMocks.trigger = () => {
        if (callbacksPending) {
            return;
        }

        callbacksPending = true;
        setTimeout(() => {
            callbacksPending = false;
            for (const callback of window.mutationObserverMocks) {
                callback();
            }
        }, Math.random() * 10);
    };

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
