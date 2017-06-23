'use strict';

const Promise = require('bluebird');
const fs = require('fs');
const browserify = require('browserify');
const {minify} = require('uglify-es');

const writeFileAsync = Promise.promisify(fs.writeFile);

const generateStandaloneBundle = async () => {
    console.log('*** Generating standalone bundle');
    const b = browserify('lib/bluefox.js', {standalone: 'Bluefox'});
    const buffer = await Promise.fromCallback(cb => b.bundle(cb));
    return buffer;
};

(async () => {
    const bundle = await generateStandaloneBundle();
    const bundleString = bundle.toString('utf8');
    const minifyResult = minify(bundleString, {
        warnings: true,
        compress: {
            unused: false,
        },
    });

    if (minifyResult.warnings) {
        console.warn('Minify warnings:', minifyResult.warnings);
    }

    await Promise.all([
        writeFileAsync('standalone.js', bundle),
        writeFileAsync('standalone.min.js', minifyResult.code, 'utf8'),
        writeFileAsync('standalone.string.js', `module.exports=${JSON.stringify(bundleString)};`, 'utf8'),
        writeFileAsync('standalone.min.string.js', `module.exports=${JSON.stringify(minifyResult.code)};`, 'utf8'),
    ]);

    console.log('*** Done!');
})();
