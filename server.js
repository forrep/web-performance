"use strict";

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const delayRegexp = /_([0-9]+)s(?=[._])/;
const graduallyRegexp = /_g(?=[._])/;
const defaultContentType = 'text/plain';
const contentTypePattern = {
    "html" : "text/html",
    "js"   : "text/javascript",
    "css"  : "text/css",
    "jpg"  : "image/jpeg",
    "jpeg" : "image/jpeg",
    "gif"  : "image/gif",
    "png"  : "image/png",
    "woff" : "application/font-woff",
    "woff2": "application/font-woff2",
    "ttf"  : "font/truetype",
    "eot"  : "application/vnd.ms-fontobject",
};

const basePath = path.dirname(process.argv[1]);
const server = http.createServer();

let port = 8080;
if (process.argv.length >= 3) {
    if (process.argv[2].match(/^[0-9]+$/)) {
        port = Number(process.argv[2]);
    }
    else {
        console.error('Invalid port. Ignoring.');
    }
}
let host = null;
if (process.argv.length >= 4) {
    host = process.argv[3];
}

const requestIdMax = 1000;
let requestIdManager = 0;
const toLoggingId = (requestId) => {
    return '[' + '0'.repeat((''+(requestIdMax-1)).length - (''+requestId).length) +  requestId + ']'
};

const handleRequest = (requestId, response, requestPath, delay, gradually, failOver) => {
    new Promise((resolve, reject) => {
        fs.access(basePath + requestPath, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    }).then(() => {
        return new Promise((resolve, reject) => {
            fs.readFile(basePath + requestPath, (err, data) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }).then((data) => {
        let start = Date.now();
        let sent = 0;
        let sentLogged = 0;
        let sentHeader = false;
        let interval = Math.min(Math.floor(delay / 100), 50);
        let contentType = defaultContentType;
        for (let key in contentTypePattern) {
            if (requestPath.endsWith("." + key)) {
                contentType = contentTypePattern[key];
                break;
            }
        };
        if (contentType.startsWith('text/')) {
            data = Buffer.from(data.toString('utf8').replace(/\${now}/g, Date.now()), 'utf8');
        }
        let sender = () => {
            let now = Date.now();
            let elapsed = now - start < 0 ? 0 : now - start;
            let progress = elapsed >= delay ? data.length : Math.floor(data.length / delay * elapsed);
            if (!sentHeader) {
                response.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-cache',
                    'Content-Length': data.length
                });
                sentHeader = true;
            }
            if (progress > sent) {
                response.write(data.slice(sent, progress), () => {
                    if (progress >= (Math.floor(sentLogged / data.length * 10) + 1) / 10 * data.length) {
                        let progressRatio = Math.floor(100 * progress / data.length);
                        console.log(' '.repeat((new Date()).toString().length + 1) + toLoggingId(requestId) + ' ' + requestPath + ' sent: ' + (progressRatio >= 100 ? 'completed (' + elapsed + 'ms)' : progressRatio + '%'))
                        sentLogged = progress;
                    }
                });
                sent = progress;
            }
            if (data.length > sent) {
                setTimeout(sender, interval);
            }
            else {
                response.end();
            }
        };
        setTimeout(sender, gradually ? interval : delay);
    }).catch((err) => {
        if (failOver) {
            handleRequest(requestId, response, requestPath + 'index.html', 0, gradually, false);
        }
        else {
            response.writeHead(404, {'Content-Type': defaultContentType});
            response.write('Not Found', 'utf8', () => {
                console.log(' '.repeat((new Date()).toString().length + 1) + toLoggingId(requestId) + ' ' + requestPath + ' 404 Not Found')
            });
            response.end();
        }
    });
};
server.on('request', (request, response) => {
    let requestId = (++requestIdManager) % requestIdMax;
    let requestPath = url.parse(request.url).pathname;
    let delay = 0;
    let delayMatch = requestPath.match(delayRegexp);
    if (delayMatch) {
        requestPath = requestPath.replace(delayRegexp, '');
        delay = Number(delayMatch[1] * 1000);
    }
    let gradually = false;
    let graduallyMatch = requestPath.match(graduallyRegexp);
    if (graduallyMatch) {
        requestPath = requestPath.replace(graduallyMatch, '');
        gradually = true;
    }

    console.log(new Date() + ' ' + toLoggingId(requestId) + ' ' + requestPath + ' (delay=' + delay + 'ms' + (gradually ? ' gradually' : '') + ')');
    handleRequest(requestId, response, requestPath, delay, gradually, requestPath.endsWith('/'));
});
server.listen(port, host, () => {
    console.log('Starting on http://' + (host ? host : 'localhost') + (port != 80 ? (':' + port) : ''));
});
