var ServerSentEvents = require('./serverSentEvents').ServerSentEvents
  , LongPolling = require('./longPolling').LongPolling;
module.exports = {
  serverSentEvents: ServerSentEvents,
  longPolling: LongPolling
};
