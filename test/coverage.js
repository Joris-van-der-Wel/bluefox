'use strict';
const path = require('path');
const glob = require('glob');

const paths = glob.sync('lib/**/*.js', {
    cwd: path.join(__dirname, '../'),
    absolute: true,
});

for (const path of paths) {
    require(path); // eslint-disable-line
}
