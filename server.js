const http = require('node:http');
const readFile = require('fs/promises').readFile;
const Redis = require("ioredis");
const sub = new Redis(); // for blocking event reading
const pub = new Redis();

const hostname = '127.0.0.1';
const port = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  res.statusCode = 200;
  const url = new URL(req.url, 'http://' + hostname);
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(await readFile('index.html'));
  }
  else if (url.pathname === '/events') {    
    req.socket.setKeepAlive(true);
    req.socket.setTimeout(0);

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader('Connection', 'keep-alive');

    const lastEventId = req.headers['last-event-id'];
    const orderId = url.searchParams.get('orderId');
    const groups = ['user:1', `order:${orderId}`];

    console.log('client connected', groups, 'lastEventId', lastEventId);

    // join groups
    await join(groups);

    function handleEvent(message) {
        const [id, data] = message;
        const mess = {[data[0]]: data[1], [data[2]]: data[3]};
        if (groups.includes(mess.destination)) {
            console.log("Id: %s. Data: %O", id, data);
            res.write(`id: ${id}\ndata: ${data}\n\n`);
        }
    }

    // start listening on new events
    subscribeToNewEvents(handleEvent);

    // get all events since the last event client saw
    // TODO: risk of getting the same message twice
    if (lastEventId) {
        const events = await getEventsSince(lastEventId);
        events.forEach(ev => handleEvent(ev));
    }

    // keep the connection open by sending a comment
    var keepAlive = setInterval(function() {
        res.write(':keep-alive\n\n');
    }, 20000);

    // cleanup on close
    res.on('close', function close() {
        clearInterval(keepAlive);
        // client disconnected leave groups
        leave(groups);
        // remove from subscription
        unsubscribeToNewEvents(handleEvent);
    });
  }
  else {
      res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not found\n');
  }
});

server.listen(port, hostname, async () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

listenForEvents();

let eventCallbacks = [];
function subscribeToNewEvents(callback) {
    eventCallbacks.push(callback);
}

function unsubscribeToNewEvents(callback) {
    eventCallbacks = eventCallbacks.filter(cb => cb !== callback);
}

/**
 * Listens for events
 * @link Based on https://github.com/luin/ioredis/blob/main/examples/stream.js
 */
function listenForEvents(lastId) {
   async function listenForMessage(lastId = "$") {
    // `results` is an array, each element of which corresponds to a key.
    // Because we only listen to one key (mystream) here, `results` only contains
    // a single element. See more: https://redis.io/commands/xread#return-value
    // long poll for 60 seconds
    const results = await sub.xread("BLOCK", 60000, "STREAMS", "inst1", lastId);
    if (results) {
        const [key, messages] = results[0]; // `key` equals to "inst1"
        for (const message of messages)
            eventCallbacks.forEach(callback => callback(message));
  
        // Pass the last id of the results to the next round.
        await listenForMessage(messages[messages.length - 1][0]);
    }
    else
        await listenForMessage(lastId);
  }
  
  listenForMessage(lastId);
}

async function getEventsSince(lastId) {
    const results = await pub.xread("STREAMS", "inst1", lastId);
    if (results) {
        const [key, messages] = results[0];
        return messages;
    }
    return [];
}

function join(groups) {
    let pipeline = pub.pipeline()
    groups.forEach(group => pipeline = pipeline.hincrby('group:' + group, 'inst1', 1));
    return pipeline.exec();
}

function leave(groups) {
    let pipeline = pub.pipeline()
    groups.forEach(group => pipeline = pipeline.hincrby('group:' + group, 'inst1', -1));
    return pipeline.exec();
}
