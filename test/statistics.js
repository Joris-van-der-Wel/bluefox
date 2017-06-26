'use strict';

const sum = array => array.reduce((result, value) => result + value, 0);

const mean = array => sum(array) / array.length;

const variance = array => {
    const arrayMean = mean(array);
    const deviationSum = array.reduce((result, value) => result + Math.pow(value - arrayMean, 2), 0);
    return deviationSum / array.length;
};

// (population standard deviation)
const standardDeviation = array => Math.sqrt(variance(array));

exports.sum = sum;
exports.mean = mean;
exports.standardDeviation = standardDeviation;
