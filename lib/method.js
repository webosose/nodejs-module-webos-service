//method.js
var pmlog = require("pmloglib");
var console = new pmlog.Console("webos-service");

var events = require('events');
var util = require("util");
/* Method constructor
 * takes two arguments
 * methodName is the name of the method registered
 * description is a JSON-format description of the method
 */
function Method(methodName, description) {
	events.EventEmitter.call(this);
	this.name = methodName;
	this.description = description;
}
util.inherits(Method, events.EventEmitter);
module.exports = Method;
