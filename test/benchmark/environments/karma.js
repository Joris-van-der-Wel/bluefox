'use strict';
/* eslint import/no-unassigned-import:off */
console.log('karma keep alive');
setInterval(() => console.log('karma keep alive'), 2000);
require('../../karmaTestEnv');
require('../manifest');
