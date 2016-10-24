'use strict';

const redis = require('redis');
const stream = require('stream');
const SeqIndex = require('seq-index');

const Writable = stream.Writable;
const Readable = stream.Readable;

class RedisWriteStream extends Writable {
    constructor(client, key, options) {
        super(options);
        this.key = key;
        this.client = client;
        this._initial = options && options.append ? options.append : true;
        this.seqIndex = new SeqIndex();
    }

    _write(chunk, encoding, callback) {
        // empty chunk, do nothing
        if (!chunk || !chunk.length) {
            return callback();
        }

        // convert string chunk into Buffer
        if (typeof chunk === 'string') {
            chunk = Buffer.from(chunk, encoding);
        }

        let writeChunk = err => {
            if (err) {
                return callback(err);
            }
            this.client.rpush(this.key + ' stream', chunk, err => {
                if (err) {
                    return callback();
                }

                callback();
            });
        };

        if (this._initial) {
            // delete old chunks for the same key before starting to write a new one
            this._initial = false;
            deleteStream(this.client, this.key, err => {
                if (err) {
                    return callback(err);
                }

                // store system metadata for this stream
                // this key can be later used to check if the stream for an ID exists or not
                this.client.set(this.key + ' root', JSON.stringify({
                    created: Date.now()
                }), err => {
                    if (err) {
                        return callback(err);
                    }
                    writeChunk();
                });
            });
        } else {
            writeChunk();
        }
    }
}

class RedisReadStream extends Readable {
    constructor(client, key, options) {
        super(options);
        this.key = key;
        this.client = client;
        this._index = Number(options && options.startIndex) || 0;
        this._initial = true;
        this._finished = false;
        this._len = 0;
    }

    _read() {
        if (this._finished) {
            return;
        }

        let readChunk = () => {
            if (this._index >= this.len) {
                this._finished = true;
                this.push(null);
                return;
            }
            this.client.lindex(this.key + ' stream', this._index++, (err, chunk) => {
                if (err) {
                    this.emit('error', err);
                    return;
                }
                if (this.push(chunk)) {
                    readChunk();
                }
            });
        };

        if (this._initial) {
            this._initial = false;
            this.client.llen(this.key + ' stream', (err, len) => {
                if (err) {
                    this.emit('error', err);
                    return;
                }
                if (!len) {
                    this._finished = true;
                    this.push(null);
                    return;
                }
                this._len = len;
                readChunk();
            });
            return;
        }

        readChunk();
    }
}

/**
 * Sets metadata for a stream
 *
 * @param {Object} client Database object
 * @param {String} key Stream key
 * @param {Object} value Data to store as JSON
 * @param {Function} callback Function to run once data is stored
 */
function streamSetMeta(client, key, data, callback) {
    client.exists(key + ' root', (err, exists) => {
        if (err) {
            return callback(err);
        }
        if (!exists) {
            return callback(null, false);
        }
        client.set(key + ' meta', Buffer.from(JSON.stringify(data)), err => {
            if (err) {
                return callback(err);
            }
            return callback(null, true);
        });
    });
}

/**
 * Gets metadata for a stream
 *
 * @param {Object} client Database object
 * @param {String} key Stream key
 * @param {Function} callback Function to run with the retrieved metadata object or false
 */
function streamGetMeta(client, key, callback) {
    client.multi().
    exists(key + ' root').
    get(key + ' root').
    get(key + ' meta').
    exec((err, replies) => {
        if (err) {
            return callback(err);
        }
        if (!replies[0]) {
            return callback(null, false);
        }

        let meta;
        if (replies[1] && replies[1].length) {
            try {
                meta = JSON.parse(replies[1].toString());
            } catch (E) {
                return callback(E);
            }
        } else {
            meta = {};
        }

        if (replies[2] && replies[2].length) {
            try {
                let data = JSON.parse(replies[2].toString());
                Object.keys(data || {}).forEach(key => {
                    meta[key] = data[key];
                });
            } catch (E) {
                return callback(E);
            }
        }

        return callback(null, meta);
    });
}

function deleteStream(client, key, callback) {
    client.multi().
    del(key + ' stream').
    del(key + ' root').
    del(key + ' meta').
    exec(err => {
        if (err) {
            return callback(err);
        }
        return callback(null, true);
    });
}

// Expose to the world!
module.exports = clientConfig => {
    let opts = {};
    Object.keys(clientConfig || {}).forEach(key => {
        opts[key] = clientConfig[key];
    });
    opts.return_buffers = true;

    let client = redis.createClient(opts);

    return {
        client,
        createReadStream: (key, options) => new RedisReadStream(client, key, options),
        createWriteStream: (key, options) => new RedisWriteStream(client, key, options),
        delete: (key, callback) => deleteStream(client, key, callback),
        setMeta: (key, data, callback) => streamSetMeta(client, key, data, callback),
        getMeta: (key, callback) => streamGetMeta(client, key, callback)
    };
};
