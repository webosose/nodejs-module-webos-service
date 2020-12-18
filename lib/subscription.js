//subscription.js
var pmlog = require("pmloglib");
var console = new pmlog.Console("webos-service");

var events = require("events");
var util = require("util");
var Message = require("./message");
//* Subscription is an EventEmitter wrapper for subscribed LS2 calls
function Subscription(handle, uri, args, sessionId) {
	events.EventEmitter.call(this);
	this.uri = uri;
	this.args = args;
	this.handle = handle;
	if (sessionId == 'undefined')
		this.request = handle.subscribe(uri, JSON.stringify(args));
	else
		this.request = handle.subscribeSession(uri, JSON.stringify(args), sessionId);

	var self = this;
	this.request.addListener("response", function(msg) {
		var payload;
		try {
			payload = JSON.parse(msg.payload());
		}
		catch (e) {
			console.error("badly-formatted message payload");
			console.error("error: " + e);
			if (e.stack) console.error(e.stack);
			console.error("payload: " + msg.payload());
			payload = {
				subscribed: false,
				returnValue: false,
				errorText: msg.payload(),
				badPayload: msg.payload()
			};
		}

		if (payload.subscribed === false) {
			self.request.cancel();
			self.emit("cancel", new Message(msg, handle));
		}
		else {
			self.emit("response", new Message(msg, handle));
		}
	});
	this.request.addListener("cancel", function(msg) {
		self.emit("cancel", new Message(msg, handle));
	});
}
util.inherits(Subscription, events.EventEmitter);

//* stop receiving responses
Subscription.prototype.cancel = function() {
	this.request.cancel();
};

module.exports = Subscription;
