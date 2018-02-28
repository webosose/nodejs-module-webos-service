//message.js - a wrapper for the palmbus message type
var pmlog = require("pmloglib");
var console = new pmlog.Console("webos-service");

/* Message constructor
 * takes two arguments, a palmbus message object, and the handle it was received on
 * third argument is the activityManager instance to use
 */
function Message(message, handle, activityManager, service) {
	this.category = message.category();
	this.method = message.method();
	this.isSubscription = message.isSubscription();
	this.uniqueToken = message.uniqueToken();
	this.token = message.token();
	try {
		this.payload = JSON.parse(message.payload());
	} catch (e) {
		console.error("badly-formatted message payload");
		console.error("error: " + e);
		if (e.stack) console.error(e.stack);
		console.error("payload: " + message.payload());
		this.payload = {badPayload: message.payload()};
	}
	if (message.applicationID() !== "") {
		// split WAM's 'pid' off of the appId
		this.sender = message.applicationID().split(" ")[0];
	} else {
		this.sender = message.senderServiceName();
	}
	this.ls2Message = message;
	this.handle = handle;
	this.activityManager = activityManager;
	this.service = service;
}

//* respond to a message, with a JSON-compatible object
Message.prototype.respond = function(response) {
	var returnValue = true;
	if (typeof response !== "object" || response === null) {
		throw("response must be an object");
	}
	var r = {};
	for (var k in response) {
		r[k] = response[k];
	}
	if (r.returnValue === undefined) {
		if (r.errorCode || r.errorText) {
			r.returnValue = false;
			if (!r.errorCode) {
				r.errorCode = -1;
			}
			if (!r.errorText) {
				r.errorText = "no error message provided";
			}
		} else {
			r.returnValue = true;
		}
	}
	if (! this.ls2Message.respond(JSON.stringify(r))) {
		console.error("ERROR: ls2Message.respond() returned false");
		returnValue = false;
	}
	if (!this.isSubscription) {
		this.activityManager.complete(this.activity, function(activityManagerRespnse) {
			console.log("completion callback");
		});
	}
	return returnValue;
};

//* inform this client that no more responses are coming
Message.prototype.cancel = function(response) {
	if (this.isSubscription) {
		this.service.cancelSubscription(this.handle, this.ls2Message);
		var r = {};
		if (typeof response === "object" && response !== null) {
			for (var k in response) {
				r[k] = response[k];
			}
		}
		else if (response !== undefined) {
			throw("response must be an object");
		}
		r.subscribed = false;
		this.respond(r);
	}
};

module.exports = Message;
