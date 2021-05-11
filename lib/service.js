// service.js: webos-service main module
// Copyright (c) 2013-2018 LG Electronics, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0
/*jshint esversion: 6 */
var pmlog = require("pmloglib");
var console = new pmlog.Console("webos-service");

// requires
var palmbus = require("palmbus");
var path = require("path");
var fs = require("fs");

// library modules
var Message = require("./message");
var Subscription = require("./subscription");
var Method = require("./method");
var ActivityManager = require("./activitymanager");

// Proxy path.exists to detect all places of usage of the deprecated and already removed function
var deprecated_path_exists = path.exists;
path.exists=function (path, existsCb) {
	fs.stat(path, function (err, stats) {
		existsCb(!err);
	});
	console.error('Deprecated path.exists used. Emulated with fs.stat. Please, update ASAP.');
};

/* Service constructor
 * first parameter is the bus ID to register
 * second, optional parameter for the ActivityManager instance to use
 * third parameter is an "options" object, which supports the following keys:
 *     noBuiltinMethods: set to "true" to prevent registering built-in methods (info & quit)
 *     idleTimer:        recommended idle time in seconds to exit
 */
function Service(busId, activityManager, options) {
	var self = this;
	process.nextTick(function() {
		// I'm just here to ensure the main event loop doesn't exit before polling (see GF-13126)
	});
	this.busId = busId;

	try {
		this.handle = new palmbus.Handle(busId);
		this.handle.addListener("request", function(message) {
			self._dispatch(self.handle, message);
		});
		this.handle.addListener("cancel", function(message) {
			self.cancelSubscription(self.handle, message);
		});
		this.sendingHandle = this.handle;
		this.useACG = true;
	}
	catch(ex) {
		console.error('Deprecated security model is used. Please update configuration for ACG security model.');
		this.privateHandle = new palmbus.Handle(busId, false);
		this.privateHandle.addListener("request", function(message) {
			self._dispatch(self.privateHandle, message);
		});
		this.privateHandle.addListener("cancel", function(message) {
			self.cancelSubscription(self.privateHandle, message);
		});
		this.publicHandle = new palmbus.Handle(busId, true);
		this.publicHandle.addListener("request", function(message) {
			self._dispatch(self.publicHandle, message);
		});
		this.publicHandle.addListener("cancel", function(message) {
			self.cancelSubscription(self.publicHandle, message);
		});

		if (this.idIsPrivileged(this.busId)) {
			this.sendingHandle = this.privateHandle;
		} else {
			this.sendingHandle = this.publicHandle;
		}
		this.useACG = false;
	}

	this.methods = {};
	this.handlers = {};
	this.cancelHandlers = {};
	this.subscriptions = {};
	this.hasPublicMethods = false;
	if (global.unified_service) {
		this.__serviceMainUnified = global.unified_service.serviceMain;
	}
	// set the "ps" process name
	if (!global.unified_service) {
		if (process.setName) {
			// Palm-modified Node.js 0.4
			process.setName(busId);
		} else {
			process.title = busId;
		}
	}
	if (options && options.noBuiltinMethods) {
		this.noBuiltinMethods = true;
	} else {
		this._registerBuiltInMethods(true);
	}
	if (options && options.idleTimer) {
		this.idleTimer = options.idleTimer;
	} else {
		this.idleTimer = 5;
	}
	if (activityManager) {
		this.activityManager = activityManager;
	} else {
		this.activityManager = new ActivityManager(this, this.idleTimer);
	}
}

Service.prototype.cleanupUnified = function() {
	if (global.unified_service && !this.cleanupUnifiedDone) {
		this.cleanupUnifiedDone = true;
		if (this.useACG) {
			this.handle.removeAllListeners();
			this.handle.unregister();
		}
		else {
			this.privateHandle.removeAllListeners();
			this.privateHandle.unregister();
			this.publicHandle.removeAllListeners();
			this.publicHandle.unregister();
		}
		this.activityManager._stopTimer();
		global.unified_service.unrequire(this.__serviceMainUnified);
	}
};

Service.prototype._dispatch = function(handle, ls2Message) {
	var message = new Message(ls2Message, handle, this.activityManager, this);
	var category = message.category;
	var method = message.method;
	//console.log("category:", category, " method:", method);
	if (this.methods[category]) {
		var methodObject = this.methods[category][method];
		if (methodObject) {
			if (message.isSubscription) {
				var cancelListeners = methodObject.listeners("cancel");
				if (cancelListeners.length === 0) {
					console.warn('a client attempted to add a subscription for '+method+' which has no "cancel" handler');
					console.warn('ignoring...');
				} else {
					this.subscriptions[message.uniqueToken] = message;
					handle.subscriptionAdd(message.uniqueToken, message.ls2Message);
				}
			}
			if (message.payload.$activity) {
				var activity = message.payload.$activity;
				console.log("adopting activity" + JSON.stringify(activity));
				this.activityManager.adopt(activity, function(response) {
					if (response.payload.returnValue) {
						console.log("setting message.activity to " + JSON.stringify(activity));
						message.activity = activity;
						methodObject.emit("request", message);
					} else {
						console.error("Activity Adopt failed: "+response.payload.errorText);
					}
				});
			} else {
				console.log("creating activity");
				this.activityManager.create(method, function(activity) {
					console.log("created activity "+JSON.stringify(activity));
					message.activity = activity;
					methodObject.emit("request", message);
				});
			}
		} else {
			console.error("No method for category ", category, ", method ", method);
		}
	} else {
		console.error("No methods for category ", category);
	}
};

/* @protected
 * handler to remove subscriptions
 */
Service.prototype.cancelSubscription = function(handle, ls2Message) {
	var id = ls2Message.uniqueToken();
	if (this.subscriptions[id]) {
		var message = this.subscriptions[id];
		var category = message.category;
		var method = message.method;

		//console.log("Cancelling subscription "+id);
		delete this.subscriptions[id];
		this.activityManager.complete(message.activity, function(activity) {
			//TODO: Do something here, maybe delay "cancel" event?
		});
		if (this.methods[category]) {
			var methodObject = this.methods[category][method];
			if (methodObject) {
				methodObject.emit("cancel", message);
			}
		}
	} else {
		console.log("Attempt to cancel unknown subscription "+id);
	}
};

/* Register a method on both buses
 * callback is called with a Message object
 */
Service.prototype.register = function(name, requestCallback, cancelCallback, description) {
	if (!this.hasPublicMethods) {
		this.hasPublicMethods = true;
		if (!this.noBuiltinMethods) {
			this._registerBuiltInMethods(false);
		}
	}

	if (this.useACG) {
		return this._register(undefined, name, requestCallback, cancelCallback, description);
	}
	else {
		return this._register(true, name, requestCallback, cancelCallback, description) &&
			this._register(false, name, requestCallback, cancelCallback, description);
	}
};

/* Register a method on the private bus ONLY
 * callback is called with a Message object
 */
Service.prototype.registerPrivate = function(name, requestCallback, cancelCallback, description) {
	return this._register(true, name, requestCallback, cancelCallback, description);
};

Service.prototype._register = function(privateBus, name, requestCallback, cancelCallback, description) {
	//console.log("registering method:'"+name+"'");
	var category;
	var methodName;
	var lastSlash = name.lastIndexOf("/");
	if (lastSlash == -1) {
		category = "/";
		methodName = name;
	} else {
		category = name.slice(0, lastSlash) || "/";
		methodName = name.slice(lastSlash+1);
	}

	if (category.charAt(0) != "/") {
		console.warn("method category "+category+" should start with '/', adding one for you...");
		category = "/" + category;
	}
	if (!this.methods[category]) {
		this.methods[category] = {};
	}
	var method = this.methods[category][methodName];
	// if method doesn't exist, create it
	if (!method) {
		method = new Method(methodName, description);
		this.methods[category][methodName] = method;
		if (requestCallback) {
			method.on("request", requestCallback);
		}
		if (cancelCallback) {
			method.on("cancel", cancelCallback);
		}
	}
	if (this.useACG) {
		this.handle.registerMethod(category, methodName);
		method.privateBusOnly = false;
	}
	else {
		if (privateBus) {
			this.privateHandle.registerMethod(category, methodName);
			method.privateBusOnly = true; // Note: this means you have to register private, then public
		} else {
			this.publicHandle.registerMethod(category, methodName);
			method.privateBusOnly = false;
		}
	}
	return method;
};

Service.prototype._registerBuiltInMethods = function(privateBus) {
	this._register(privateBus, "quit", this.quit.bind(this), undefined, {
		description: "quits the service",
		arguments: "[none]"
	});
	this._register(privateBus, "info", this.info.bind(this), undefined, {
		description: "returns information about the service",
		arguments: "[none]"
	});
};

/* Determine if a particular id is "privileged", and allowed to send
 * on the private bus
 */
Service.prototype.idIsPrivileged = function(id) {
	var specials = [
		"com.palm.",
		"com.lge.",
		'com.webos.'
	];
	for (var i=0; i < specials.length; i++) {
		// only matches if the id *starts* with the special domains
		if (id.indexOf(specials[i]) === 0) {
			return true;
		}
	}
	return false;
};

/* Call a service on the bus
 * The args parameter is a JSON-compatible object
 * The callback gets passed a Message object
 */
Service.prototype.call = function(...params) {
	if (params.length !== 3 && params.length !== 4)
		throw("wrong arguments");

	var uri = params[0];
	var args = params[1];
	var callback = (params.length === 3) ? params[2] : params[3];
	var sessionId = (params.length === 4) ? params[2] : 'undefined';

	if (typeof args !== "object")
		throw("payload must be an object");

	var handle = this.sendingHandle;
	var request;
	if (sessionId === 'undefined')
		request = handle.call(uri, JSON.stringify(args));
	else
		request = handle.callSession(uri, JSON.stringify(args), sessionId);

	request.addListener("response", function(msg) {
		if (callback) {
			callback(new Message(msg, handle));
		}
	});
};

/* Subscribe to a service on the bus
 * The args parameter is a JSON-compatible object
 * Returns a Subscription object which raises events when responses come in
 */
Service.prototype.subscribe = function(...params) {
	if (params.length !== 2 && params.length !== 3)
		throw("wrong arguments");

	var uri = params[0];
	var args = params[1];
	var sessionId = (params.length === 3) ? params[2] : 'undefined';

	if (typeof args !== "object") {
		throw("args must be an object");
	}

	return new Subscription(this.sendingHandle, uri, args, sessionId);
};

/* Quit the service
 *
 */
Service.prototype.quit = function(message) {
	// If there are no public methods, don't allow "quit" from public bus
	if (!this.hasPublicMethods) {
		if (message.handle != this.privateHandle) {
			message.respond({returnValue: false, errorText: 'The "quit" method is not supported on the Public bus'});
			return;
		}
	}
	message.respond({status: "quitting"});
	var that = this;
	// Why is there a 50ms timeout? Because the actual sending of the response is
	// asynchronous, and process.nextTick() was not *quite* enough time
	// It would be nice to have a callback on the JS side for "message sent"
	setTimeout(function() {
		if (!global.unified_service) {
			process.exit(0);
		} else {
			that.cleanupUnified();
		}
	}, 50);
};

/* Provide some usage information for the service
 *
 */
Service.prototype.info = function(message) {
	var info = {};
	var categories = Object.keys(this.methods);
	for (var i=0; i < categories.length; i++) {
		var category = categories[i];
		//console.log("Category: "+category);
		var methods = Object.keys(this.methods[category]);
		for (var j=0; j < methods.length; j++) {
			var methodName = methods[j];
			var method = this.methods[category][methodName];
			//console.log("Method: "+method);
			var methodPath = path.join(category, methodName);
			//console.log("method:" + methodPath+" privateBusOnly: " + method.privateBusOnly);
			if (!method.privateBusOnly || (message.handle == this.privateHandle) ) {
				info[methodPath] = method.description||{};
			}
		}
	}
	message.respond({commands: info});
};

module.exports = Service;
