'use strict';

module.exports = config => {
    config.set({
        basePath: '../../..',
        frameworks: ['mocha', 'browserify'],
        files: [
            'test/integration/environments/karma.js',
        ],
        preprocessors: {
            'test/integration/environments/karma.js': ['browserify'],
        },
        proxies: {
            '/static': 'http://localhost:8123/static',
            '/empty': 'http://localhost:8123/empty',
        },
        browserify: {
            debug: true,
        },
        reporters: ['progress'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        singleRun: true,
        browsers: [
            'Firefox',
        ],
    });
};
