/* eslint no-unused-expressions:0, prefer-arrow-callback: 0 */
/* globals afterEach, beforeEach, describe, it */

'use strict';

const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const crypto = require('crypto');
const redisStreamAccess = require('../lib/redis-stream-access.js');
const redisStream = redisStreamAccess({
    host: 'localhost',
    port: 6379,
    db: 12
});

chai.config.includeStack = true;

describe('redis-stream-access tests', function () {
    it('should write and read data from db using write/read', function (done) {
        let instream = fs.createReadStream(__dirname + '/fixtures/alice.txt');
        let writestream = redisStream.createWriteStream('test1');
        writestream.on('finish', function () {
            let md5 = crypto.createHash('md5');
            let readstream = redisStream.createReadStream('test1');
            readstream.on('data', function (chunk) {
                md5.update(chunk);
            });
            readstream.on('end', function () {
                expect(md5.digest('hex')).to.equal('ff5c6c94bcd0f12d6769d1b623d9503d');
                done();
            });
        });
        instream.pipe(writestream);
    });

    it('should set and get metadata', function (done) {
        let meta = {
            a: 1,
            b: [1, 2, 3]
        };
        redisStream.setMeta('non-existant-key', meta, (err, success) => {
            expect(err).to.not.exist;
            expect(success).to.be.false;
            redisStream.setMeta('test1', meta, (err, success) => {
                expect(err).to.not.exist;
                expect(success).to.be.true;
                redisStream.getMeta('test1', (err, stored) => {
                    expect(err).to.not.exist;
                    expect(meta === stored).to.be.false;
                    expect(meta.b).to.be.deep.equal(stored.b);
                    expect(stored.created).to.exist;
                    done();
                });
            });
        });
    });

    it('should delete existing keys', function (done) {
        redisStream.getMeta('test2', (err, meta) => {
            expect(err).to.not.exist;
            expect(meta).to.exist;
            redisStream.delete('test2', function (err, deleted) {
                expect(err).to.not.exist;
                expect(deleted).to.be.true;
                redisStream.getMeta('test2', (err, meta) => {
                    expect(err).to.not.exist;
                    expect(meta).to.be.false;
                    done();
                });
            });
        });
    });
});
