/* jshint node:true */
/* jshint browser:true */

'use strict';

var Bungee = require('./index.js');

// since we are in the browser, register it into the global namespace
window.Bungee = Bungee;
