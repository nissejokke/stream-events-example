
const Redis = require("ioredis");
const pub = new Redis();

let count1 = 20;
setInterval(async () => {
  const pids = await pub.smembers('group:order:1');
  for (const pid of pids)
    pub.xadd(pid, "*", "destination", "order:1", "count", count1);
  count1++;
}, 3000);

let count2 = 20;
setInterval(async () => {
  const pids = await pub.smembers('group:order:2');
  for (const pid of pids)
    pub.xadd(pid, "*", "destination", "order:2", "count", count2);
  count2++;
}, 8000);