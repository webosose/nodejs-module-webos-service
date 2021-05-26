//activitymanager.js
//activity tracking and ActivityManager integration
var pmlog = require("pmloglib");
var console = new pmlog.Console("webos-service");

var activityManagerURI = "luna://com.webos.service.activitymanager";
var instance;
function ActivityManager(service, idleTimeout) {
	// Create only one ApplicationManager, so we only have one timeout
	//TODO: refactor this so that we aren't using a "Singleton" ActivityManager instance
	if (instance) {
		return instance;
	}
	this._idleTimer = null;
	this._activities = {};
	this._counter=1;
	if (process.argv.indexOf("--disable-timeouts") !== -1) {
		this.exitOnTimeout = false;
	} else {
		this.exitOnTimeout = true;
	}
	this.useDummyActivity = -1 !== process.argv.indexOf("--disable-activity-creation");
	this._dummyActivityId = 1;
	this.idleTimeout = idleTimeout || 5; //seconds
	this._startTimer();
	this.service = service;
	if (!global.unified_service) {
		instance = this;
	}
}

ActivityManager.prototype._add = function(id, activity) {
	this._stopTimer();
	if (this._activities[id]) {
		console.warn('Activity "'+id+'" already started');
	} else {
		this._activities[id] = activity;
		if (global.unified_service)
			global.unified_service.increaseActivity();
	}
};

ActivityManager.prototype._remove = function(id) {
	if (!this._activities[id]) {
		console.warn('Activity "'+id+'" not started');
	} else {
		this._activities[id].cancel();
		delete this._activities[id];
		if (global.unified_service)
			global.unified_service.decreaseActivity();
	}
	if (Object.keys(this._activities).length == 0) {
		this._startTimer();
		if (global.unified_service)
			global.unified_service.enterIdle();
	}
};

ActivityManager.prototype.create = function(spec, callback) {
	if (typeof spec === "string") {
		if (this.useDummyActivity)
			return this._createDummy(spec, callback);
		else
			return this._createInternal(spec, callback);
	} else {
		return this._createActual(spec, callback);
	}
};

ActivityManager.prototype._createDummy = function(jobId, callback) {
	// _createInternal step
	jobId += this._counter++;
	console.log("Creating dummy activity for " + jobId);
	var activitySpec = {
		isDummyActivity: true,
		activity: { name: jobId }
	};

	// _createActual step
	var activityId = "dummy_" + this._dummyActivityId++;
	activitySpec.activityId = activityId;
	console.log("ActivityId = " + activityId);
	this._add(activityId, { cancel: function() {} });
	if (callback) {
		callback(activitySpec);
	}
};

ActivityManager.prototype._createInternal = function(jobId, callback) {
	jobId += this._counter++;
	console.log("Creating activity for "+jobId);
	var activitySpec = {
		"activity": {
			"name": jobId, //this needs to be unique, per service
			"description": "activity created for "+jobId, //required
			"type": {
				"foreground": true, // can use foreground or background, or set individual properties (see Activity Specification below, for details)
				"persist": false,   // this activity will be persistent across reboots
				"explicit": true    // this activity *must* be completed or cancelled explicitly, or it will be re-launched until it does
			}
		},
		"start": true,             // start the activity immediately when its requirements (if any) are met
		"replace": true,           // if an activity with the same name already exists, replace it
		"subscribe": true         // if "subscribe" is false, the activity needs to be adopted immediately, or it gets canceled
	};
	return this._createActual(activitySpec, callback);
};

ActivityManager.prototype._createActual = function(activitySpec, callback) {
	var activityId;
	var activityManager = this;
	if (activitySpec.subscribe) {
		var createSub = this.service.subscribe("luna://com.webos.service.activitymanager/create", activitySpec);
		createSub.on("response", function(reply) {
			var payload = reply.payload;
			if (!payload.returnValue) {
				console.error("Activity creation failed: "+payload.errorText);
				if (callback) {
					callback(payload);
				}
			} else {
				if (!reply.payload.event) {
					activityId = reply.payload.activityId;
					activitySpec.activityId = activityId;
					console.log("ActivityId = "+activityId);
					activityManager._add(activityId, createSub);
					if (callback) {
						callback(activitySpec);
					}
				} else if (reply.payload.event == "complete") {
					console.log("activity complete, cancelling subscription");
					createSub.cancel();
				}
			}
		});
	} else {
		// not a subscription - just create the activity
		this.service.call("luna://com.webos.service.activitymanager/create", activitySpec, function(response) {
			var payload = response.payload;
			if (!payload.returnValue) {
				console.error("Activity creation failed: "+payload.errorText);
				if (callback) {
					callback(payload);
				}
			} else {
				if (callback) {
					activityId = payload.activityId;
					activitySpec.activityId = activityId;
					callback(activitySpec);
				}
			}
		});
	}
};

ActivityManager.prototype.adopt = function(activity, callback) {
	var id = activity.activityId;
	var adoptSub = this.service.subscribe(activityManagerURI+"/adopt", {activityId: id, subscribe: true, wait: false});
	var activityManager = this;
	adoptSub.on("response", function(message) {
		if (message.payload.adopted) {
			console.log("adopted " + id);
			activityManager._add(id, adoptSub);
			if (callback) {
				callback(message);
			}
		} else if (!message.payload.returnValue) {
			console.error("Adopt of "+id+" failed");
			//TODO: maybe do something different if this fails? call an errorback?
			if (callback) {
				callback(message);
			}
		}
	});
};

ActivityManager.prototype.complete = function(activity, options, callback) {
	console.log("completing: "+JSON.stringify(activity));
	// make "options" optional
	if (typeof options === "function" && callback === undefined) {
		callback = options;
	}
	if (options === undefined) {
		options = {};
	}
	// only complete an activity once
	if (activity.completed) {
		return false;
	} else {
		activity.completed = true;
	}
	var activityId = activity.activityId;

	if (activity.isDummyActivity) {
		this._remove(activityId);
		if (callback) {
			callback(activity);
		}
		return;
	}

	var activityManager = this;
	var params = {activityId: activityId};
	Object.keys(options).forEach(function(key) {
		params[key] = options[key];
	});
	console.log("completing with params: "+JSON.stringify(params));
	this.service.call(activityManagerURI+"/complete", params, function(message) {
		if (!message.payload.returnValue) {
			console.error("Failed to complete "+activityId+", error: "+message.payload.errorText);
		}
		activityManager._remove(activityId);
		if (callback) {
			callback(activity);
		}
	});
};

ActivityManager.prototype._startTimer = function() {
	if (this._idleTimer) {
		console.log("idle timer already started, ignoring");
		return;
	}
	var that = this;
	this._idleTimer = setTimeout(function() {
		if (that.exitOnTimeout) {
			console.log("no active activities, exiting");
			if (!global.unified_service) {
				process.exit(0);
			} else {
				that.service.cleanupUnified();
			}
		} else {
			console.log("no active activities, would exit, but timeout is disabled");
		}
	}, this.idleTimeout * 1000);
};

ActivityManager.prototype._stopTimer = function() {
	if (!this._idleTimer) {
		console.log("idle timer already stopped, ignoring");
		return;
	}
	clearTimeout(this._idleTimer);
	this._idleTimer = null;
};

module.exports = ActivityManager;
