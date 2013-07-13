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

    ret.debug = false;
    ret.verbose = false;

    function ensureEngine(engine) {
        if (!engine) {
            console.log('[Bungee] Using default engine with DOM renderer.');
            engine = new ret.Engine(new ret.RendererDOM());
        }

        return engine;
    }

    ret.jump = function (engine) {
        engine = ensureEngine(engine);

        ret.useQueryFlags();
        ret.compileScriptTags(engine);
        engine.start();
    };

    ret.useQueryFlags = function() {
        // TODO improve detection
        ret.verbose = (window.location.href.indexOf("verbose") >= 0);
        ret.debug = (window.location.href.indexOf("debug") >= 0);
    };

    ret.compileScriptTagElement = function(engine, script) {
        engine = ensureEngine(engine);

        var tokens = ret.Tokenizer.parse(script.text);
        var moduleName = script.attributes.module && script.attributes.module.textContent;
        var o, n;

        ret.Compiler.compileAndRender(tokens, { module: moduleName }, function (error, result) {
            if (error) {
                console.error("Bungee compile error: " + error.line + ": " + error.message);
                console.error(" -- " + error.context);
            } else {
                if (ret.verbose || ret.debug) {
                    console.log("----------------------");
                    console.log(result);
                    console.log("----------------------");
                    console.log("eval...");
                    o = new Date();
                }

                if (result.indexOf('module.exports = ') === 0) {
                    if (!ret.Modules) {
                        ret.Modules = {};
                    }

                    result = result.replace('module.exports = ', 'Bungee.Modules.' + moduleName + ' = ');
                    eval(result);
                } else {
                    var tmp = eval(result);
                    tmp(Bungee, engine);
                }

                if (ret.verbose || ret.debug) {
                    n = new Date();
                    console.log("done, eval took time: ", (n - o), "ms");
                }
            }
        });
    };

    ret.compileScriptTags = function(engine, dom) {
        engine = ensureEngine(engine);

        for (var i = 0; i < window.document.scripts.length; ++i) {
            var script = window.document.scripts[i];
            if (script.type === "text/jmp" || script.type === "text/jump") {
                ret.compileScriptTagElement(engine, script);
            }
        }
    };

    return ret;
}());
