
const Redis = require("ioredis");
const pub = new Redis();

let count1 = 20;
setInterval(async () => {
  const obj = await pub.hgetall('group:order:1');
  const pids = Object.keys(obj).filter(key => obj[key] > 0);

  for (const pid of pids) {
    await pub.xadd(pid, "*", "type", "order", "orderId", "1", "count", count1);
  }
  if (pids.length)
    count1++;
}, 3000);

let count2 = 20;
setInterval(async () => {
  const obj = await pub.hgetall('group:order:2');
  const pids = Object.keys(obj).filter(key => obj[key] > 0)

  for (const pid of pids) {
    await pub.xadd(pid, "*", "type", "order", "orderId", "2", "count", count2);
  }
  if (pids.length)
    count2++;
}, 8000);