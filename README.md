# redis-stream-access

Write and read stream values from Redis database

## Installation

Install _redis-stream-access_ from npm. You also need [redisup](https://www.npmjs.com/package/redis) to be installed.

```
npm install redis-stream-access redis
```

## Setup

Create a _redis-stream-access_ instance by providing a Redis config object that is used for storage.

```javascript
const redisStreamAccess = require('redis-stream-access');
const redisStream = redisStreamAccess({host: 'localhost', port: 6379});
```

## createWriteStream()

Write a large stream into redisdb database

```javascript
let writer = redisStream.createWriteStream('keyname');
```

**Example**

```javascript
fs.createReadStream('file.txt').
    pipe(redisStream.createWriteStream('keyname'));
```

## createReadStream()

Read a stream from redisdb database

```javascript
let reader = redisStream.createReadStream('keyname');
```

**Example**

```javascript
redisStream.createReadStream('keyname').
    pipe(process.stdout);
```

## setMeta()

Attach JSON metadata to the stored stream. This value gets removed when you delete the stream. If there already was metadata set, it gets overwritten. If the stream does not exists, then metadata is not stored and callback returns false, otherwise it returns true

```javascript
redisStream.setMeta(keyname, data, callback);
```

Where

- **keyname** is the stream key to add metadata to
- **data** is an object that can be converted to JSON
- **callback** is the function to run once data is stored

**Example**

```javascript
redisStream.setMeta('keyname', {
    filename: 'some-file.txt'
}, function(err, stored){
    if(err){
        console.log(err);
    }else if(!stored){
        console.log('Stream was not found');
    }else{
        console.log('metadata was stored');
    }
});
```

## getMeta()

Get JSON metadata for the stored stream. This value combines both the user defined metadata using `setMeta` and system metadata (eg. `created` with creation timestamp).

```javascript
redisStream.getMeta(keyname, callback);
```

Where

- **keyname** is the stream key to get metadata for
- **callback** is the function to run once data is stored

**Example**

```javascript
redisStream.setMeta('keyname', function(err, meta){
    if(err){
        console.log(err);
    }
    if(!meta){
        console.log('Stream was not found!');
    }else{
        // user defined metadata
        console.log(meta.filename); // 'some-file.txt'
        // system provided metadata
        console.log(meta.created); // 1470901349281
    }
});
```

## delete()

Delete streamed data from redisdb

```javascript
redisStream.delete('keyname', callback);
```

**Example**

```javascript
redisStream.delete('keyname', function(err, deleted){
    if(err){
        console.log(err);
    }else{
        console.log('%s chunks deleted', deleted);
    }
});
```

## License

**MIT**
