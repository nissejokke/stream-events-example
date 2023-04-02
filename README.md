# Example of how to use server side events and redis streams to garantee delivery of messages to client in multi node nodejs environment.

## Running example

Start server

    node index.js

Start producer

    node gen.js

Browse to http://localhost:3000

## How it works

_Client_:

Client uses EventSource to listen to events for order 1. If client is disconnected it will try to reconnect and in that process send the id of the last event it saw.

```javascript
    const evt = new EventSource('/events?orderId=1');
    evt.onmessage = (event) => {};
```

_Server_:

Listens on events from a redis stream dedicated to this server instance. 
Only this server instance will listen to this perticular redis stream. Inst1 in this example should rather be for example servername + process 1.

This code either 1) long polls until a new event added to 'inst1' stream or 2) if lastId is set, reads all events added after lastId.

60000 is number of millisecconds to long poll.

    redis.xread('BLOCK', 60000, 'STREAMS', 'inst1', lastId)

_Producer_:

A producer is a separate process that handles updates from other services and adds these to the 'inst1' stream

    redis.xadd('inst1', event)

## Multiple instances

For a producer to know which instance streams to add events to a redis set is used

_Server_:

When a client is connected it passes in which orders (or groups) it is interested in.
The following adds inst1 to order:1 group.

    redis.sadd('group:order:1', 'inst1')

_Producer_:

When updates from other services are retrivied for order:1 the producer knows which streams to add to
by checkin which members are in order:1 group

    redis.smembers('group:order:1') // inst1

    Add event to inst1 stream

    redis.xadd('inst1', event)

## Links

Redis streams
https://redis.io/docs/data-types/streams/

EventSource
https://developer.mozilla.org/en-US/docs/Web/API/EventSource