'use strict';

const Promise = require('bluebird');
const express = require('express');
const serveIndex = require('serve-index');
const Throttle = require('throttle');
const {resolve: pathResolve} = require('path');
const {statAsync: stat, createReadStream} = Promise.promisifyAll(require('fs'));
const mime = require('mime');
const morgan = require('morgan');

const staticDirectoryPath = pathResolve(__dirname, './static');
const app = express();

const isTextMime = mimeType => {
    return /^text\//.test(mimeType) || mimeType === 'application/javascript';
};

app.set('x-powered-by', false);
app.use(morgan('dev'));

/**
 * Supported query parameters:
 *
 * waitBeforeResponse - Wait this many milliseconds before sending a response
 * noCache - Send no cache headers
 * bytesPerSecond - Throttle the response streaming of static files (in bytes per second)
 */

app.use((request, response, next) => {
    if (request.query.waitBeforeResponse) {
        setTimeout(() => next(), Number(request.query.waitBeforeResponse));
    }
    else {
        next();
    }
});

app.use((request, response, next) => {
    if ('noCache' in request.query) {
        response.set('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
        response.set('Pragma', 'no-cache'); // HTTP 1.0.
        response.set('Expires', '0'); // Proxies.
    }
    next();
});

app.get('/', (request, response) => {
    response.status(404).send(`<a href="/static">Interesting stuff is at /static`);
});

app.get('/static/*', (request, response, next) => {
    const path = pathResolve(staticDirectoryPath, './' + request.path.substr('/static/'.length));

    if (!path.startsWith(staticDirectoryPath)) {
        throw Error('Invalid request.path');
    }

    stat(path).then(stats => {
        if (!stats.isFile()) {
            next();
            return;
        }

        const mimeType = mime.getType(path);
        response.setHeader('Content-Type', isTextMime(mimeType) ? `${mimeType}; charset=utf-8` : mimeType);

        const readStream = createReadStream(path);

        if (request.query.bytesPerSecond) {
            readStream.pipe(new Throttle({
                bps: Number(request.query.bytesPerSecond),
            })).pipe(response);
        }
        else {
            readStream.pipe(response);
        }

    })
    .catch(error => (error.code === 'ENOENT' ? next() : next(error)));
});
app.use('/static', serveIndex(staticDirectoryPath, {icons: true}));

app.get('/404', (request, response) => {
    response.status(404).send('Thing not found!');
});

app.get('/empty', (request, response) => {
    response.status(200).send('');
});

app.use((request, response) => {
    response.status(404).send('Thing not found!');
});

app.use((error, request, response, next) => {
    console.error(error.stack);
    response.status(500).send('Something broke!');
});

app.listen(8123, () => console.log('http server listening on port 8123'));
