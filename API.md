{toc}
h2. Purpose

The webos-service module for Node.js provides an interface to the system bus, wrapped in familiar Node.js idioms.

h2. How do I get it?
You can get the source via
{{git clone https://github.com/webosose/nodejs-module-webos-service.git}}


There are a couple of sample services in the git repository, which may be useful.

h2. Example
{code:lang=javascript|title=helloworld.js}
// simple service, based on webos-service API

var Service = require('webos-service');

var service = new Service("com.example.helloworld");

service.register("hello", function(message) {
	message.respond({
		greeting: "Hello, World!"
	});
});
{code}
This registers a service (luna://com.example.helloworld/hello) on both the public and private buses, which responds to a request with a "Hello, World\!" message.

h2. API reference

h3. loading the webos-service library

*var Service = require("webos-service")*
This loads the webos-service module. The only thing exported from the webos-service module is the Service constructor.

h3. Service object

*var service = new Service(busID)*
Creates a Service object, which contains handles for both the public and private buses.
* busId is a string containing the bus address of the service, e.g. "com.example.helloworld"

*service.activityManager* - the ActivityManager proxy object for this service (see below).

*service.busId* - the busId used when creating the Service

*service.call(uri, arguments, function callback(message)\{...})*
This sends a one-shot request to another service. The request is sent on the Private bus if this is a "privileged" service, otherwise, it goes out on the Public bus.
* The {{uri}} parameter is the bus address of the service to send to, for example: luna://com.webos.service.wifi/status
* The {{arguments}} parameter is a JSON-compatible object which is encoded by the library and sent as part of the request
* The {{callback}} function is called with a single parameter, which is a {{Message}} (described below)

*service.isIdPrivileged(id)* - Checks to see if the given id is a "privileged" sender, e.g. com.lge.*. This could be used to return different responses to queries from system services vs. third-party services.

*service.register(methodName, \[function request(message)\{...}], \[function cancel(message)\{...}])*
Registers a method for the service, on both the public and private buses. When a request is made for that method, the callback function will be called. The callback gets one argument, which is a {{Message}} object (see below).
* methodName is the name of the method to register. You can group methods in categories by putting a category at the front of the methodName, separated by "/" characters, e.g.
{code}
service.register("/config/setup", function callback(message)\{...});
{code}
This function returns a {{Method}} object (see below), which emits the {{request}} and {{cancel}} events. If the {{request}} and {{cancel}} arguments are provided, they're bound to the "request" and "cancel" events, respectively.

*service.subscribe(uri, arguments)*
This sends a subscription request to another service, for services that support it. The request is sent on the Private bus if this is a "privileged" service, otherwise, it goes out on the Public bus. The {{uri}} and {{arguments}} are the same as {{call}}, above. This function returns a {{Subscription}} object (see below), which emits events as responses come back from the other service.

*service.subscriptions* - all of the {{Message}}s currently subscribed to this service, indexed by their LS2 uniqueToken.

h5. Obscure API
*Service.privateHandle* - Provides access to the private bus handle.
*Service.publicHandle* - Provides access to the public bus handle.
You could use these to send a message on the Public bus, even if you're a privileged service, for example.
*service.registerPrivate(methodName, \[function request(message)\{...}], \[function cancel(message)\{...}])*
Registers a method for the service, on *only* the private bus. This would be useful for methods that would only be called by system services or applications.

h3. Message object
{{Message}} objects are used to represent messages coming in from other services or applications.

*message.cancel()* - this sends a "cancel" message to the sender, which indicates no more responses will be coming. This is normally only used for subscribed calls. Single-shot calls do not require a "cancel" response.

*message.category* - the category of the method that was called.

*message.isSubscription* - this is set to {{true}} if {{"subscribe": true}} is included in the payload, which indicates the sender wants to subscribe.

*message.method* - the name of the method that was called. This is the part of the service URI that's before the method name.

*message.payload* - the payload (or arguments) sent with the message. This is JSON-parsed from the string sent with the message. If the parsing fails (some services *do not* properly JSON-encode their responses), then the response text will be in the "responseText" property of the payload.

*message.respond(payload)* - this sends a response to the requester.
* The {{payload}} object will be JSON-encoded before being sent. Every response should include a "returnValue" property, which is set to {{true}} for success replies, and {{false}} for errors.

*message.sender* - the applicationID or busID of the message sender, depending on whether it was sent from an app or another service

*message.uniqueToken* - a string which uniquely identifies this request. It is guaranteed to be unique within any one run of the service. If you need to track service requests, this is probably the token you want to use. This corresponds to the Native LS2 API "uniqueToken"

h5. Obscure API
*message.ls2Message* - a copy of the "palmbus" Message object. This might be useful for accessing API that hasn't been made available in webos-service yet.

*message.token* - this is a "friendly" version of the message token serial number that can be used to correlate requests to ls-monitor output. In particular, this token is *not* guaranteed to be unique to a particular request (different clients might use the same token). This is generally only useful in debugging output.

h3. Method object
*var method = service.register(methodName\[, requestCallback]\[, cancelCallback])*
Creates a {{Method}} object, which is an EventEmitter that emits the "request" and "cancel" methods.

*event "request"* - this event is emitted when a message is sent to the registered method. The even handler is passed the {{Message}} object corresponding to the request.

*event "cancel"* - this event is emitted when a sender of a message indicates that it is no longer interested in receiving replies. This event is only emitted for subscribed messages.

h3. Subscription object
*var subscription = service.subscribe(uri, payload)*
this creates a Subscription object, representing a request to {{uri}}.
* The {{uri}} is the complete URI for the service method, e.g. luna://com.webos.service.wifi/status
* The {{payload}} is an object, which is JSON-encoded before sending

*subscription.on("response", function callback(message)\{...})*
A {{response}} event is sent every time the other service sends a response. The callback receives a single {{Message}} parameter.

*subscription.on("cancel", function callback(message)\{...})*
The {{cancel}} response indicates that the other service has canceled that subscription. It is a good idea to remove any references to the subscription at that time, so that the message can be garbage-collected.

*subscription.cancel()*
Sends a "cancel" message to the other service., indicating that you no longer wish to receive responses.

h3. ActivityManager object
*var activityManager = service.activityManager;*
This object represents a proxy to the ActivityManager LS2 service (com.webos.service.activitymanager), and also provides a timer that's used to control a service's lifetime.

*activityManager.create("name", callback)*
Creates an activity with a reasonable set of default properties, for immediate execution by the service. The service will not exit due to timeout while an activity is active. Note that the webos-service library creates a new activity for each request that comes in, so you don't need to create your own for simple cases. Your callback will be called with the new activity as an argument.

*activityManager.create(activitySpecification, callback)*
Creates an activity with the given activity specification. This is useful when you want to create an activity with a callback, to cause your service to be executed at a later time. See [How to use ActivityManager for dynamic services] for more information. Your callback will be called with the new activity as an argument.

*activityManager.complete(activity, options, callback)*
This "completes" the activity. The webos-service library automatically completes the activity associated with a particular message when you call respond() on it.

You might call "complete" explicitly if you wanted to specify options to the complete operation, for example, to restart the activity, or change the triggers or schedule associated with the activity.

h2. Handling Subscriptions

h3. Client-side subscriptions
On the client (requester) side, subscriptions are handled by the {{Subscription}} object. In most cases, you merely need to do something like this:
{code}
var Service = require('webos-service');
var service = new Service("com.webos.service.test");
var sub = service.subscribe("luna://com.webos.service.connection/status", {"subscribe": true});
sub.on("response", function(message) {
	//do something with the subscription
});
{code}

h3. Service-side subscriptions
The library offers some built-in support for services that would like to support subscriptions. If a {{Method}} has a "cancel" handler, then it's considered to be subscribable. The library automatically tracks subscription requests, registering them with LS2 to ensure that "cancel" events are delivered properly.

Your "request" handler for the {{Method}} should check the {{Message}}'s "isSubscription" property, to determine whether a subscription has been requested. In most cases, you'll want to add subscribed messages to an array or Object hash, in order to keep track of them when it's time to update them later.

Here's a partial example, from the helloworld sample in the source
{code}
var subscriptions = {};
// EventEmitter-based API for subscriptions
// note that the previous examples are actually using this API as well, they're
// just setting a "request" handler implicitly
var heartbeat = service.register("heartbeat2");
heartbeat.on("request", function(message) {
	message.respond({event: "beat"}); // initial response
	if (message.isSubscription) {
		subscriptions[message.uniqueToken] = message; //add message to "subscriptions"
		if (!interval) {
			createInterval(); // launch some async process
		}
	}
});
heartbeat.on("cancel", function(message) {
	delete subscriptions[message.uniqueToken]; // remove message from "subscriptions"
	var keys = Object.keys(subscriptions);
	if (keys.length === 0) { // count the remaining subscriptions
		console.log("no more subscriptions, canceling interval");
		clearInterval(interval); // don't do work in the background when there are no subscriptions
		interval = undefined;
	}
});
{code}

h3. Frequently asked Questions (FAQ) and troubleshooting hints
See this article on [JavaScript services FAQ & troubleshooting hints]

(this document is also available in the source repository at ssh://gpro.lgsvl.com/webos-pro/nodejs-module-webos-service)
