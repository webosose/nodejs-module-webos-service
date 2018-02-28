nodejs-module-webos-service
===========================

Summary
-------
A low-level library for node.js services on Webos

Description
-----------

###Objectives
1. A minimalist library for services on WebOS
2. Not a framework, just helper functions - don't lock developers into a single app design

###Things in mojoservice that need re-evaluation
 * Dependency between JSON-formatted services.json, and the names of controllers - why have the same information in two places, and does it make sense to have "magic" connection between service names and class names?
 * Command/idle timeouts - was a significant source of confusion
 * Futures - some people loved them, some hated them
 * Using mojoloader instead of require()

###Things we definitely want to keep/expand from Mojoservice
 * "info" and "quit" commands - great for testing, probably don't need to have them be __info and __quit, though
 * (optional?) support of schemas for input validation

###Service bootstrap process
A service application is launched by the service bus when a request comes in that targets that service, and the service is not already running.

The service hub determines which services are available by parsing the files in:
/usr/share/dbus-1/services 
/var/palm/ls2/services/pub
/usr/share/dbus-1/system_services
/var/palm/ls2/services/prv

These files are windows-style INI files, which should have a .service extension. The contents should look like this:
[D-BUS Service]
Name=com.webos.service.contacts
Exec=/usr/bin/run-js-service -n /usr/palm/services/com.webos.service.contacts

###Roles files
Every service needs roles files, located in:

/usr/share/ls2/roles/pub
/usr/share/ls2/roles/prv
/var/palm/ls2/roles/pub
/var/palm/ls2/roles/prv

for public and private bus configurations. Note that even services that don't need private bus access usually still have to provide a private role file - the system-provided services and apps will try to contact the service over the private bus.

These are JSON-formatted files, and will contain a set of "roles", which are the bus addresses listened on, and permissions for those roles (which other bus clients can make requests to this service)

###Weird behavior/bugs
ls-control scan-services will tell hubd to look for new .services files to identify launchable services
making a request via luna-send -i then closing luna-send doesn't seem to close the subscription.

luna-bus will reject requests for a service if it doesn't have a .service file, even if a program has successfully-registered a handle. The error message in this case is "service does not exist". 

###Development setup
On Windows:
Use OpenSSH for Windows (http://sourceforge.net/projects/sshwindows/) I tried PuTTY, but couldn't get pscp to work reliably, which is important for automating the build/update process.

###Installing NPM on the emulator
Until we get a more-recent version of Node.js on the emulator, you'll need to install NPM manually. Copy the npm-install.sh file to the emulator via scp, and run it to install NPM.

# Copyright and License Information

Copyright (c) 2012-2018 LG Electronics, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

SPDX-License-Identifier: Apache-2.0
