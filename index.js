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

    ret.Tokenizer = require('./src/tokenizer.js');
    ret.Compiler = require('./src/compiler.js');
    ret.Engine = require('./src/engine.js');
    ret.Elements = require('./src/dom.js');
    ret.Animation = require('./src/animation.js');
    ret.Helper = require('./src/helper.js');

    function mixin(obj) {
        for (var e in obj) {
            if (obj.hasOwnProperty(e)) {
                ret[e] = obj[e];
            }
        }
    }

    mixin(ret.Engine);
    mixin(ret.Elements);
    mixin(ret.Animation);
    mixin(ret.Helper);

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
        var tokens = ret.Tokenizer.parse(source);
        ret.Compiler.compileAndRender(tokens, options, function (error, result) {
            callback(error, result);
        });
    };

    return ret;
}());
