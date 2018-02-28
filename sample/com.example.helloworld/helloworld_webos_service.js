// helloworld_webos_service.js
// simple service, based on low-level Palmbus API

var Service = require('webos-service');

// Register com.example.helloworld, on both buses
var service = new Service("com.example.helloworld");
var greeting = "Hello, World!";

// a method that always returns the same value
service.register("hello", function(message) {
	console.log("In hello callback");
	message.respond({
		returnValue: true,
		message: greeting
	});
});

// set some state in the service
service.register("config/setGreeting", function(message) {
	console.log("In setGreeting callback");
	if (message.payload.greeting) {
		greeting = message.payload.greeting;
	} else {
		message.respond({
			returnValue: false,
			errorText: "argument 'greeting' is required",
			errorCode: 1
		});
	}
	message.respond({
		returnValue: true,
		greeting: greeting
	});
});

// call another service
service.register("locale", function(message) {
	console.log("locale callback");
	service.call("luna://com.webos.settingsservice/getSystemSettings", {"key":"localeInfo"}, function(m2) {
		var response = "You appear to have your locale set to: " + m2.payload.settings.localeInfo.locales.UI;
		console.log(response);
		message.respond({message: response});
	});
});

// handle subscription requests
var interval;
var subscriptions = {};
var x = 1;
function createInterval() {
	if (interval) {
		return;
	}
	console.log("create new interval");
	interval = setInterval(function() {
		sendResponses();
	}, 1000);
}

// send responses to each subscribed client
function sendResponses() {
	console.log("Sending responses, subscription count="+Object.keys(subscriptions).length);
	for (var i in subscriptions) {
		if (subscriptions.hasOwnProperty(i)) {
			var s = subscriptions[i];
			s.respond({
				returnValue: true,
				event: "beat "+x
			});
		}
	}
	x++;
}

// listen for requests, and handle subscriptions via implicit event handlers in call
// to register
service.register("heartbeat", function(message) {
	var uniqueToken = message.uniqueToken;
	console.log("heartbeat callback, uniqueToken: "+uniqueToken+", token: "+message.token);
	message.respond({event: "beat"});
	if (message.isSubscription) {
		subscriptions[uniqueToken] = message;
		if (!interval) {
			createInterval();
		}
	}
},
function(message) {
	var uniqueToken = message.uniqueToken;
	console.log("Canceled " + uniqueToken);
	delete subscriptions[uniqueToken];
	var keys = Object.keys(subscriptions);
	if (keys.length === 0) {
		console.log("no more subscriptions, canceling interval");
		clearInterval(interval);
		interval = undefined;
	}
});

// a method that cancels subscriptions from service side
service.register("cancel_subscriptions", function(message) {
	console.log("canceling all subscriptions to heartbeat");
	for (var i in subscriptions) {
		if (subscriptions.hasOwnProperty(i)) {
			var s = subscriptions[i];
			s.cancel({message: "sorry"});
		}
	}
	message.respond({returnValue: true});
});

// EventEmitter-based API for subscriptions
// note that the previous examples are actually using this API as well, they're
// just setting a "request" handler implicitly
var heartbeat2 = service.register("heartbeat2");
heartbeat2.on("request", function(message) {
	console.log("heartbeat callback");
	message.respond({event: "beat"});
	if (message.isSubscription) {
		subscriptions[message.uniqueToken] = message;
		if (!interval) {
			createInterval();
		}
	}
});
heartbeat2.on("cancel", function(message) {
	console.log("Canceled " + message.uniqueToken);
	delete subscriptions[message.uniqueToken];
	var keys = Object.keys(subscriptions);
	if (keys.length === 0) {
		console.log("no more subscriptions, canceling interval");
		clearInterval(interval);
		interval = undefined;
	}
});

service.register("ping", function(message) {
	console.log("Ping! setting up activity");
	var activitySpec = {
		"activity": {
			"name": "My Activity", //this needs to be unique, per service
			"description": "do something", //required
			"background": true,	// can use foreground or background, or set individual properties (see Activity Specification below, for details)
			"persist": true,	// this activity will be persistent across reboots
			"explicit": true,	// this activity *must* be completed or cancelled explicitly, or it will be re-launched until it does
			"callback": {		// what service to call when this activity starts
				"method": "luna://com.example.helloworld/pong", // URI to service
				"params": {		// parameters/arguments to pass to service
				}
			}
		},
		"start": true,		// start the activity immediately when its requirements (if any) are met
		"replace": true,	// if an activity with the same name already exists, replace it
		"subscribe": false	// if "subscribe" is false, the activity needs to be adopted immediately, or it gets canceled
	};
	service.call("luna://com.webos.service.activitymanager/create", activitySpec, function(reply) {
		var activityId = reply.payload.activityId;
		console.log("ActivityId = "+activityId);
		message.respond({msg: "Created activity "+activityId});
	});
});

service.register("pong", function(message) {
	console.log("Pong!");
	console.log(message.payload);
	message.respond({message: "Pong"});
});

service.register("/do/re/me", function(message) {
	message.respond({verses:[
		{doe: "a deer, a female deer"},
		{ray: "a drop of golden sun"},
		{me: "a name I call myself"}
	]});
});

var count = 0;
service.register("increment", function(message) {
	count++;
	message.respond({
		count: count
	});
});

service.register("getCount", function(message) {
	message.respond({
		count: count
	});
});

var service2 = new Service("com.example.helloworld2");
service2.registerPrivate("hello", function(message) {
	message.respond({msg: "hello"});
});
