"use strict";

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const delayRegexp = /_([0-9]+)s(?=[._])/;
const graduallyRegexp = /_g(?=[._])/;
const defaultContentType = 'text/html';

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

const requestIdMax = 100;
let requestIdManager = 0;

const handleRequest = (requestId, response, requestPath, delay, gradually, failOver) => {
    Promise.all(['', '/css', '/js'].map((subPath) => {
        return new Promise((resolve, reject) => {
            fs.access(basePath + subPath + requestPath, (err) => {
                if (err) {
                    resolve(false);
                }
                else {
                    resolve(subPath);
                }
            });
        })
    })).then((subPathes) => {
        let subPath = false;
        for (let i = 0; i < subPathes.length; ++i) {
            if (subPathes[i] !== false) {
                subPath = subPathes[i];
                break;
            }
        }
        if (subPath === false) {
            return Promise.reject();
        }
        return new Promise((resolve, reject) => {
            fs.readFile(basePath + subPath + requestPath, 'utf8', (err, data) => {
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
        let sender = () => {
            let now = Date.now();
            let elapsed = now - start < 0 ? 0 : now - start;
            let progress = elapsed >= delay ? data.length : Math.floor(data.length / delay * elapsed);
            if (!sentHeader) {
                let contentType = defaultContentType;
                if (requestPath.endsWith(".css")) {
                    contentType = 'text/css';
                }
                else if(requestPath.endsWith(".js")) {
                    contentType = 'application/javascript';
                }
                response.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-cache',
                    'Transfer-Encoding': 'chunked'
                });
                sentHeader = true;
            }
            if (progress > sent) {
                response.write(data.substring(sent, progress), 'utf8', () => {
                    if (progress >= (Math.floor(sentLogged / data.length * 10) + 1) / 10 * data.length) {
                        let progressRatio = Math.floor(100 * progress / data.length);
                        console.log(' '.repeat((new Date()).toString().length) + ' [' + '0'.repeat((''+requestIdMax).length - (''+requestId).length) +  requestId + '] ' + requestPath + ' sent: ' + (progressRatio >= 100 ? 'completed (' + elapsed + 'ms)' : progressRatio + '%'))
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
                console.log(' '.repeat((new Date()).toString().length) + ' [' + '0'.repeat((''+requestIdMax).length - (''+requestId).length) +  requestId + '] ' + requestPath + ' 404 Not Found')
            });
            response.end();
        }
    });
};
server.on('request', (request, response) => {
    let requestId = (++requestIdManager) % requestIdMax;
    let requestPath = url.parse(request.url).pathname;
    let delay = 0;
    let gradually = false;
    let delayMatch = requestPath.match(delayRegexp);
    if (delayMatch) {
        requestPath = requestPath.replace(delayRegexp, '');
        delay = Number(delayMatch[1] * 1000);
    }
    let graduallyMatch = requestPath.match(graduallyRegexp);
    if (graduallyMatch) {
        requestPath = requestPath.replace(graduallyMatch, '');
        gradually = true;
    }

    console.log(new Date() + ' [' + '0'.repeat((''+requestIdMax).length - (''+requestId).length) +  requestId  + '] ' + requestPath + ' (delay=' + delay + 'ms' + (gradually ? ' gradually' : '') + ')');
    handleRequest(requestId, response, requestPath, delay, gradually, requestPath.endsWith('/'));
});
server.listen(port, host, () => {
    console.log('Starting on http://' + (host ? host : 'localhost') + (port != 80 ? (':' + port) : ''));
});
