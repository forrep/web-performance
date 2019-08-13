"use strict";

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const delayRegexp = /_([0-9]+)s/;
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

const handleRequest = (res, requestPath, delay, failOver) => {
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
        setTimeout(() => {
            let contentType = defaultContentType;
            if (requestPath.endsWith(".css")) {
                contentType = 'text/css';
            }
            else if(requestPath.endsWith(".js")) {
                contentType = 'application/javascript';
            }
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            });
            res.write(data);
            res.end();
        }, delay);
    }).catch((err) => {
        if (failOver) {
            handleRequest(res, '/index.html', 0, false);
        }
        else {
            res.writeHead(404, {'Content-Type': defaultContentType});
            res.write('Not Found');
            res.end();
        }
    });
};
server.on('request', (req, res) => {
    let requestPath = url.parse(req.url).pathname;
    let delay = 0;
    let delayMatch = requestPath.match(delayRegexp);
    if (delayMatch) {
        requestPath = requestPath.replace(delayRegexp, '');
        delay = Number(delayMatch[1] * 1000);
    }

    console.log(new Date() + ' delay=' + delay + ' ' + requestPath);
    handleRequest(res, requestPath, delay, requestPath === '/' || requestPath.endsWith('.html'));
});
server.listen(port, host);
