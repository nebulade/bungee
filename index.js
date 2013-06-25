/*
 **************************************************
 *  Bungee.js
 *
 *  (c) 2012-2013 Johannes Zellner
 *
 *  Bungee may be freely distributed under the MIT license.
 *  For all details and documentation:
 *  http://bungeejs.org
 **************************************************
 */

"use strict";

var fs = require('fs');

module.exports = (function () {
    var ret = {};

    ret.tokenizer = require('./src/tokenizer.js');
    ret.compiler = require('./src/compiler.js');

    ret.compileFile = function(file, options, callback) {
        fs.readFile(file, 'utf8', function (error, data) {
            if (error) {
                callback(error);
            } else {
                ret.compile(data, options, callback);
            }
        });
    };

    ret.compile = function(source, options, callback) {
        var tokens = ret.tokenizer.parse(source);
        console.log("$$$$", tokens);
        ret.compiler.compileAndRender(tokens, options, function (error, result) {
            callback(error, result);
        });
    };

    return ret;
}());
