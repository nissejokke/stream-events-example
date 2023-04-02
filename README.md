# Example of how to use server side events and redis streams to garantee delivery of messages to client in multi node nodejs environment

## Running example

Start server

    node server.js

Start producer

    node producer.js

Open two tabs listening for events to two different orders

    open http://localhost:3000/?orderId=1
    open http://localhost:3000/?orderId=2

Wait for events to be received. Try stopping the server for a while and then starting it again. The client should get all missed events produced during the downtime.

## How it works

_Client_:

Client uses EventSource to listen to events for an order. If client is disconnected, it will try to reconnect and, in that process, send the id of the last event it saw.

```javascript
    const evt = new EventSource('/events?orderId=1');
    evt.onmessage = (event) => {};
```

_Server_:

Listens on events from a redis stream dedicated to this server instance. 
Only this server instance will listen to this particular redis stream. 'inst1', in this example, is the stream dedicated to this server. In a production environment, streams should probably be named, for example server name + process id.

The server starts receiving new events from the redis stream directly upon start. Events are sent to all connected clients and filtered depending on which order id each client is listening to.

If a client connects and sends 'last event id', it means that it is a reconnect and, in this case, fetch all events newer than this event.

The following code reads all events after 'lastId' from 'inst1' stream. If at least one event exists on the stream, the command resolves directly. If no events exist, it will long poll for at most 60 seconds for new events.

    redis.xread('BLOCK', 60000, 'STREAMS', 'inst1', lastId)

_Producer_:

A producer is a separate process that handles updates from other services and adds these to the 'inst1' stream.

    redis.xadd('inst1', event)

## Multiple instances

When running in a multi-node environment, the producer must know which streams to update for specific orders. For a producer to know which instance streams to add events to, a redis hash is used in this example.

_Server_:

When a client is connected, it joins a group.
The following adds increaces 'inst1' value of the 'order:1' group.

    redis.hincrby('group:order:1', 'inst1', 1)

_Producer_:

When updates from other services come in for 'order:1', the producer knows which streams to add to by checking which instances have > 0 value in the 'order:1' group

    redis.hmgetall('group:order:1') 
    // inst1: 1

Add event to 'inst1' stream

    redis.xadd('inst1', event)

##  Left to do

- Sanitize members of groups in case of a server crash / recycle
- Remove old events from streams
    - xadd has an ability to cap stream length; this could be useful
    - Still needs to remove old streams when a server instance is recycled and gets new name
        - Could have a job that lists streams in redis and removes all streams where the last event in the stream is older than certain time

## Links

Redis streams
https://redis.io/docs/data-types/streams/

EventSource
https://developer.mozilla.org/en-US/docs/Web/API/EventSource