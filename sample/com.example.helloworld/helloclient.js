// helloclient.js
// Subscribe & cancel subscription to helloworld's heartbeat service
var Service = require('webos-service');

// Register com.example.helloworld, on both buses
var service = new Service("com.example.helloclient");
service.activityManager.create("KeepAlive"); // no callback, so we'll never be able to stop this activity...
console.log("simple call");
	service.call("luna://com.example.helloworld/hello", {}, function(message) {
	console.log("message payload: " + JSON.stringify(message.payload));
	service.call("luna://com.example.helloworld/increment", {}, function(message) {
		var cnt = message.payload.count;
		console.log("count: "+cnt);
		service.call("luna://com.example.helloworld/getCount", {}, function(message) {
			if (message.payload.count != cnt) {
				throw("bad count "+message.payload.count);
			}
			console.log("count verified");
			var count = 0;
			var max = 10;
			console.log("subscription - cancel after "+max+" responses");
			var sub = service.subscribe("luna://com.example.helloworld/heartbeat", {subscribe: true});
			sub.addListener("response", function(msg) {
				console.log(JSON.stringify(msg.payload));
				if (++count >= max) {
					console.log("cancelling subscription");
					// sub.cancel();
					service.call("luna://com.example.helloworld/cancel_subscriptions", {});
					console.log("testing not including a callback - CHECK LOG FOR ERRORS");
					service.call("luna://com.example.helloworld/hello", {});
					setTimeout(function(){
						console.log("exiting...");
						process.exit(0);
					}, 100);
				}
			});
		});
	});
});
