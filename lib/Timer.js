'use strict';

class Timer {
    constructor(delay, callback) {
        this._id = 0;
        this.delay = delay;
        this.callback = callback;
        this.setTimeout = Timer.setTimeout;
        this.clearTimeout = Timer.clearTimeout;
        this._timerCallback = () => {
            this._id = 0;
            this.callback.call(null);
        };
    }

    get isScheduled() {
        return Boolean(this._id);
    }

    schedule() {
        if (!this._id) {
            this._id = this.setTimeout(this._timerCallback, this.delay);
        }
    }

    cancel() {
        if (this.isScheduled) {
            this.clearTimeout(this._id);
            this._id = 0;
        }
    }

    reschedule() {
        this.cancel();
        this.schedule();
    }
}

/* istanbul ignore next */
Timer.setTimeout = (func, delay) => setTimeout(func, delay);
/* istanbul ignore next */
Timer.clearTimeout = (id) => clearTimeout(id);

module.exports = Timer;
