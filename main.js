const express = require('express');
const bodyparser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const Q = require('q');
const morgan = require('morgan');
const fs = require('fs-extra');
const path = require('path');
const funcs = require('./funcs');

var cfg = {
    srv_addr: 'localhost',
    srv_port: 8081,
    sql_addr: 'localhost',
    sql_user: 'quirkboard',
    sql_pass: 'quirkpass',
    sql_database: 'quirkboard',
    message_min_len: 1,
    subject_max_len: 32,
    max_file_size: '5mb'
};

var sqlcon_pool = mysql.createPool({
    host: cfg.sql_addr,
    user: cfg.sql_user,
    password: cfg.sql_pass,
    database: cfg.sql_database
});

var cnt = {
    txt: {
        'Content-Type': 'text/plain'
    },
    json: {
        'Content-Type': 'application/json'
    }
};

const app = express();
const jsonparser = bodyparser.json({
    limit: cfg.max_file_size
});

app.use(morgan('dev'));
app.use(cors());

app.get('/', function(req, res) {
    res.writeHead(200, cnt.txt);
    res.write('Quirkboard server root ./');
    res.end();
});

app.get('/api/boards', function(req, res) {
    sqlcon_pool.getConnection(function(err, con) {
        con.query('SELECT * FROM boards', function(err, rows, fields) {
            if (err) {
                throw err;
            } else {
                res.json(rows);
            }
            con.release();
        });
    });
});

app.get('/api/boards/:boardid/stats', function(req, res) {

    sqlcon_pool.getConnection(function(err, con) {

        var getThreadCount = function() {
            var deferred = Q.defer();
            if (req.params.boardid != 1) {
                con.query('SELECT COUNT(id) AS solution FROM threads WHERE boardid = ?', req.params.boardid,
                    deferred.makeNodeResolver());
            } else {
                con.query('SELECT COUNT(id) AS solution FROM threads', deferred.makeNodeResolver());
            }
            return deferred.promise;
        };

        var getMessageCount = function() {
            var deferred = Q.defer();
            if (req.params.boardid != 1) {
                con.query(
                    'SELECT COUNT(id) AS solution FROM messages WHERE threadid IN(SELECT threadid FROM threads WHERE boardid = ?)',
                    req.params.boardid, deferred.makeNodeResolver());
            } else {
                con.query('SELECT COUNT(id) AS solution FROM messages', deferred.makeNodeResolver());
            }
            return deferred.promise;
        };

        Q.all([getThreadCount(), getMessageCount()]).then(function(results) {
            var threads = results[0][0][0].solution;
            var messages = results[1][0][0].solution;
            var result = {
                threads,
                messages
            };

            res.send(result);
        });

        con.release();

    });

});

app.get('/api/threads/:boardid', function(req, res) {

    var params = {
        boardid: req.params.boardid,
        startid: req.query.startid
    };

    var start = eval(params.startid);
    if (!params || !params.startid) {
        start = 0;
    }

    var end = start + 20;

    sqlcon_pool.getConnection(function(err, con) {
        if (req.params.boardid != 1) {
            con.query('SELECT * FROM threads WHERE boardid = ? ORDER BY modified DESC LIMIT ?, ?', [params.boardid,
                    start, end
                ],
                function(err, rows, fields) {
                    if (err) {
                        throw err;
                    } else {
                        res.json(rows);
                    }
                    con.release();
                });
        } else {
            con.query('SELECT * FROM threads ORDER BY modified DESC LIMIT ?, ?', [start, end],
                function(err, rows, fields) {
                    if (err) {
                        throw err;
                    } else {
                        res.json(rows);
                    }
                    con.release();
                });
        }
    });

});

app.post('/api/threads/:boardid', jsonparser, function(req, res) {

    // Get posted thread object
    var thread = req.body.thread;

    // Return if thread doesn't exist
    if (!thread) {
        res.status(400).send({
            error: 'Client error: no thread object supplied in post data.'
        });
        return;
    }

    thread.boardid = req.params.boardid;

    // Get posted file object (if exists), delete it from the thread object after
    var file = funcs.extractBase64FileFromObject(thread);

    // Reject if required parameter is nulll
    if (funcs.containsNullProperty(thread)) {
        res.status(400).send({
            error: 'Client error: supplied parameters contained null values.'
        });
        return;
    }

    // Reject if message is empty
    if (thread.message.length < cfg.message_min_len) {
        res.status(400).send({
            error: 'Client error: message cannot be empty.'
        });
        return;
    }

    // Assign message to subject if subject is empty
    if (thread.subject.length == 0) {
        thread.subject = thread.message;
    }

    // Truncate subject if too long
    if (thread.subject.length > cfg.subject_max_len) {
        thread.subject = thread.subject.substring(0, cfg.subject_max_len) + '...';
    }

    sqlcon_pool.getConnection(function(err, con1) {
        con1.query('SELECT * FROM boards WHERE id = ?',
            thread.boardid,
            function(err, rows1, fields1) {
                if (err) {
                    throw err;
                } else {
                    if (rows1.length <= 0) {
                        res.status(400).send({
                            error: 'Client error: supplied boardid does not exist.'
                        });
                    } else {
                        sqlcon_pool.getConnection(function(err, con2) {
                            con2.query('INSERT INTO threads SET ?', thread, function(err, rows2,
                                fields2) {
                                if (err) {
                                    throw err;
                                } else {

                                    if (file[2]) {

                                        var target_path = './public_files/uploads/' +
                                            file[0];

                                        console.log('File upload attempt: ' +
                                            file[0] + ' ...');

                                        fs.writeFile(target_path, file[1], 'base64',
                                            function(
                                                err) {
                                                if (err) {
                                                    throw err;
                                                }
                                                console.log(
                                                    "File saved successfully. Path: " +
                                                    target_path
                                                );
                                            });
                                    }

                                    res.status(200).end();
                                }
                                con2.release();
                            });
                        });
                    }
                }
                con1.release();
            });
    });

});

app.get('/api/messages/:threadid', function(req, res) {

    var params = {
        threadid: req.params.threadid,
        startid: req.query.startid
    };

    var start = eval(params.startid);
    if (!params || !params.startid) {
        start = 0;
    }

    var end = start + 100;

    sqlcon_pool.getConnection(function(err, con) {
        con.query('SELECT * FROM messages WHERE threadid = ? LIMIT ?, ?', [params.threadid, start, end],
            function(err, rows, fields) {
                if (err) {
                    throw err;
                } else {
                    res.json(rows);
                }
                con.release();
            });
    });

});

app.post('/api/messages/:threadid', jsonparser, function(req, res) {

    // Get posted message object
    var message = req.body.message;

    // Return if message doesn't exist
    if (!message) {
        res.status(400).send({
            error: 'Client error: no message object supplied in post data.'
        });
        return;
    }

    message.threadid = req.params.threadid;

    // Get posted file object (if exists), delete it from the message object after
    var file = funcs.extractBase64FileFromObject(message);

    console.log(message);
    console.log(file);

    if (funcs.containsNullProperty(message)) {
        res.status(400).send({
            error: 'Client error: supplied parameters contained null values.'
        });
        return;
    }

    if (message.message.length < cfg.message_min_len) {
        res.status(400).send({
            error: 'Client error: message cannot be empty.'
        });
        return;
    }

    sqlcon_pool.getConnection(function(err, con) {

        var threadExists = function() {
            var deferred = Q.defer();
            con.query('SELECT id AS solution FROM threads WHERE id = ?', message.threadid, deferred.makeNodeResolver());
            return deferred.promise;
        };

        Q.all([threadExists()]).then(function(results1) {
            var noThread = results1[0][0][0].solution;

            if (!noThread || noThread == 0) {
                noThread = true;
            } else {
                noThread = false;
            }

            if (noThread) {
                res.status(400).send({
                    error: 'Client error: supplied threadid does not exist.'
                });
            } else {

                var insertMessage = function() {
                    var deferred = Q.defer();
                    con.query('INSERT INTO messages SET ?', message, deferred.makeNodeResolver());
                    return deferred.promise;
                };

                var modifyThread = function() {
                    var deferred = Q.defer();
                    con.query('UPDATE threads SET modified=NOW() WHERE id=?', message.threadid,
                        deferred.makeNodeResolver());
                    return deferred.promise;
                };

                if (file[2]) {

                    var target_path = './public_files/uploads/' +
                        file[0];

                    console.log('File upload attempt: ' +
                        file[0] + ' ...');

                    fs.writeFile(target_path, file[1], 'base64',
                        function(
                            err) {
                            if (err) {
                                throw err;
                            }
                            console.log(
                                "File saved successfully. Path: " +
                                target_path
                            );
                        });
                }

                Q.all([insertMessage(), modifyThread()]).then(function(results2) {
                    console.log("test!");
                    res.status(200).end();
                });

            }
        });

        con.release();

    });

});

var srv = app.listen(cfg.srv_port, function() {

    var host = srv.address().address;
    var port = srv.address().port;

    console.log("Quirkboard REST service listening at http://%s:%s", host, port);

});
