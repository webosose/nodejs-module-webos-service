//activitysamples.js
var Service = require("webos-service");
var PmLog = require("pmloglib");

var context = new PmLog.Context("com.example.activityexample");
var service = new Service("com.example.activityexample");
var activityManagerUri = "luna://com.webos.service.activitymanager";

service.register("createAlarm", function(message) {
	var activitySpec = {
	    "activity": {
	        "name": "Alarm", //this needs to be unique, per service
	        "description": "periodic activity for activityexample", //required
	        "type": {
		        "foreground": true,    // can use foreground or background, or set individual properties (see Activity Specification below, for details)
	        },
	        "persist": false,      // this activity will be persistent across reboots
	        "explicit": true,      // this activity *must* be completed or cancelled explicitly, or it will be re-launched until it does
	        "callback": {          // what service to call when this activity starts
	            "method": "luna://com.example.activityexample/alarmFired", // URI to service
	            "params": {        // parameters/arguments to pass to service
	            	fired: true
	            }
	        },
	        "schedule": {

	        }
	    },
	    "start": true,             // start the activity immediately when its requirements (if any) are met
	    "replace": true,           // if an activity with the same name already exists, replace it
	    "subscribe": false         // if "subscribe" is false, the activity needs to be adopted immediately, or it gets canceled
	};
	service.activityManager.create(activitySpec, function(activity) {
		var activityId = activity.activityId;
		console.log("ActivityId = "+activityId);
		message.respond({msg: "Created activity "+activityId});
	});
});

service.register("createTimer", function(message) {
	var activitySpec = {
	    "activity": {
	        "name": "Timer", //this needs to be unique, per service
	        "description": "periodic activity for activityexample", //required
	        "type": {
		        "foreground": true,    // can use foreground or background, or set individual properties (see Activity Specification below, for details)
	        },
	        "persist": false,      // this activity will be persistent across reboots
	        "explicit": true,      // this activity *must* be completed or cancelled explicitly, or it will be re-launched until it does
	        "callback": {          // what service to call when this activity starts
	            "method": "luna://com.example.activityexample/timerFired", // URI to service
	            "params": {        // parameters/arguments to pass to service
	            	fired: true
	            }
	        },
	        "schedule": {
	        	interval: "5m"
	        }
	    },
	    "start": true,             // start the activity immediately when its requirements (if any) are met
	    "replace": true,           // if an activity with the same name already exists, replace it
	    "subscribe": false         // if "subscribe" is false, the activity needs to be adopted immediately, or it gets canceled
	};
	service.activityManager.create(activitySpec, function(activity) {
		var activityId = activity.activityId;
		console.log("ActivityId = "+activityId);
		message.respond({msg: "Created activity "+activityId});
	});
});

service.register("cancelActivity", function(message) {
	if (!message.payload.activityId) {
		message.respond({returnValue: false, errorText: "activityId must be specified"});
		return;
	}
	var args = {
		activityId: message.payload.activityId,
		restart: false
	};
	service.activityManager.complete(args);
	message.respond({status: "cancelling"});
});

service.register("timerFired", function(message) {
	if (!message.payload.$activity) {
		message.respond({returnValue: false, errorText: "$activity must be specified"});
		return;
	}
	var activity = message.payload.$activity;
	console.log("timer fired, resetting");
	var options = {
		restart: true
	};
	service.activityManager.complete(activity, options, function(reply) {
		console.log("activityId "+activity.activityId+" completed/restarted.");
		message.respond({message: "activityId "+activity.activityId+" completed, and restarted."});
	});
});

service.register("alarmFired", function(message) {
	if (!message.payload.$activity) {
		message.respond({returnValue: false, errorText: "$activity must be specified"});
		return;
	}
	var activity = message.payload.$activity;
	var args = {
		restart: false
	};
	service.activityManager.complete(activity, options, function(message) {
		console.log("activityId "+activityId+" completed.");
		message.respond({message: "activityId "+activityId+" completed."});
	});
});
