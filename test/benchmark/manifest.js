'use strict';

setInterval(() => console.log('keep alive'), 2000);
console.info(
    '!BENCH!',
    'Test Name',
    'Samples',
    'Mean (accuracy)',
    'Population Standard Deviation (precision)',
    'Total Check Count',
    'Total Check Overhead',
    'Mean Check Overhead',
    'StdDev Check Overhead'
);

/* eslint import/no-unassigned-import:off */
require('./lib-evaluation');
require('./readyState');
require('./selector');
require('./xpath');
