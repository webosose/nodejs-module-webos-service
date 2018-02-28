
var path = require("path");
var fs = require("fs");
//load the palmbus extension
var palmbus = require("palmbus");
console.log("starting");
function load_roles(name) {
	var rolesDirs = ["/usr/share/ls2", "/var/palm/ls2"];
	var i;
	var dir;

	for (i=0; i < rolesDirs.length; i++) {
		dir = rolesDirs[i];
		if (fs.existsSync(dir+"/roles/pub/"+name+".json")) {
			break;
		}
	}
	console.log("pushing roles files from ", dir);
	var publicRolePath  = dir+"/roles/pub/"+name+".json";
	var privateRolePath = dir+"/roles/prv/"+name+".json";
	//console.info("registering public");		
	var publicHandle = new palmbus.Handle(null, true);
	//console.info("pushing public role "+publicRolePath);		
	publicHandle.pushRole(publicRolePath);
	//console.info("registering private");
	var privateHandle = new palmbus.Handle(null, false);
	//console.info("pushing private role "+privateRolePath);		
	privateHandle.pushRole(privateRolePath);
}
load_roles("com.example.helloworld");
console.log("Registering public & private handles");
var publicHandle = new palmbus.Handle("com.example.helloworld", true);
var privateHandle = new palmbus.Handle("com.example.helloworld", false);
var handles = [publicHandle, privateHandle];

function makePrintRequestHandler(handle) {
	return function(message) {
		var category = message.category();
		var method = message.method();
		var token = message.uniqueToken();
		console.log("Request received - category %s, method %s, token %s, token %s", category, method, token);
	};
}

var x = 0;
var intervals = {};

function makeHandler(handle) {
	return function(message) {
		request(handle, message);
	};
}

function request(handle, msg) {
	var token = msg.uniqueToken();
	var category = msg.category();
	var method = msg.method();
	if (msg.isSubscription()) {
		handle.subscriptionAdd(token, msg);
		console.log("adding subscription for "+category+"/"+method+" token "+token);
		var interval = setInterval(function(){
			msg.respond(JSON.stringify({beat: x++}));
		}, 1000);
		intervals[token] = interval;
	}
}

function cancel(msg) {
	var token = msg.uniqueToken();
	console.log("cancelling "+token);
	clearInterval(intervals[token]);
	intervals[token] = undefined;
}

console.log("Registering methods");
for (var i=0;i <2; i++) {
	var h = handles[i];
	h.addListener("request", makePrintRequestHandler(h));
	h.registerMethod("/","heartbeat");
	h.addListener("request", makeHandler(h));
	h.addListener("cancel", cancel);
}
