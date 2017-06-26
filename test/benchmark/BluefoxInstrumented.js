'use strict';

const Bluefox = require('../..');
const {sum, mean, standardDeviation} = require('../statistics');

// todo node.js?
const now = () => global.performance.now();

class BluefoxInstrumented extends Bluefox {
    constructor() {
        super();

        this.executions = new Map();
        this.onExecuteBegin = ({executionId}) => {
            this.executions.set(executionId, {
                begin: now(),
                end: NaN,
                checks: [],
                currentCheckBegin: NaN,
            });
        };
        this.onExecuteEnd = ({executionId}) => {
            const obj = this.executions.get(executionId);
            obj.end = now();
        };
        this.onCheckBegin = ({executionId}) => {
            const obj = this.executions.get(executionId);
            obj.currentCheckBegin = now();
        };
        this.onCheckEnd = ({executionId}) => {
            const obj = this.executions.get(executionId);
            obj.checks.push(now() - obj.currentCheckBegin);
        };
    }

    getStatistics() {
        const executionDurations = [...this.executions]
            .map(obj => obj.end - obj.begin)
            .filter(duration => isFinite(duration));
        const allCheckDurations = [...this.executions.values()].map(obj => obj.checks); // [ [1,2], [3,4] ]
        const allCheckDurationsFlat = [].concat(...allCheckDurations);

        return {
            executionCount: executionDurations.length,
            executionDurationMean: mean(executionDurations),
            executionDurationStdDev: standardDeviation(executionDurations),
            checkCount: allCheckDurationsFlat.length,
            checkOverheadTotal: sum(allCheckDurationsFlat),
            checkOverheadMean: mean(allCheckDurationsFlat),
            checkOverheadStdDev: standardDeviation(allCheckDurationsFlat),
        };
    }
}

module.exports = BluefoxInstrumented;
