// helloworld_enyo.js
// Helloworld service, in Enyo

enyo.kind({
	name: "HelloWorld",
	address: "com.example.helloworld",
	kind: "Service",
	components: [
	],
	events: {
	}
});

new HelloWorld().start();
