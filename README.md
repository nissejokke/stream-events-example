# Event streams

    Klient:

        Klienten longpollar efter events (med EventSource i javascript)

        GET /events?orderId=1

    Server:

        Lyssnar på events från en stream dedikerad den instansen av fo.web, 
        endast den instansen av fo.web kommer lyssna på events från den streamen.
        xread långpollar upp till 60 sekunder i väntan på nya events ned följande anrop

        redis.xread('BLOCK', 60000, 'STREAMS', 'pid1', lastId)

    Fo.web.jobs:

        redis.xadd('pid1', event)


För att veta vilken instans av fo.web som jobs ska publicera events till så används ett set i redis

    Server:

        Nä klient ansluter så läggs den instansen till i ett set
        Detta säger att events för order 1 ska skickas till pid1

        redis.sadd('group:order:1', 'pid1')

    Fo.web.jobs:

        När ett event kommmer från oms som tillhör order 1 så kan jobs ta reda på vilka instanser
        det eventet ska publiceras på genom att hämta ut vilka instanser som är knutna till order 1

        redis.smembers('group:order:1') // pid1
        redis.xadd('pid1', event)

