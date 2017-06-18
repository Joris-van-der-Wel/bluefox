'use strict';

module.exports = config => {
    config.set({
        basePath: '../../..',
        frameworks: ['mocha', 'browserify'],
        files: [
            'test/unit/*.js',
        ],
        preprocessors: {
            'test/unit/*.js': ['browserify'],
        },
        browserify: {
            debug: true,
            configure(bundle) {
                bundle.ignore('jsdom');
            },
        },
        reporters: ['progress'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        singleRun: true,
        browsers: [
            'Firefox',
            'Chrome',
        ],
    });
};
