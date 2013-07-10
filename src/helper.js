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

/*
 **************************************************
 * Bungee Helper
 **************************************************
 */

var Bungee = {};
Bungee.debug = false;
Bungee.verbose = false;

Bungee.jump = function (engine) {
    Bungee.useQueryFlags();
    Bungee.compileScriptTags();
    engine.start();
};

Bungee.useQueryFlags = function() {
    // TODO improve detection
    Bungee.verbose = (window.location.href.indexOf("verbose") >= 0);
    Bungee.debug = (window.location.href.indexOf("debug") >= 0);
};

Bungee.compileScriptTagElement = function(script) {
    var tokens = Bungee.Tokenizer.parse(script.text);
    var moduleName = script.attributes.module && script.attributes.module.textContent;
    var o, n;

    Bungee.Compiler.compileAndRender(tokens, { module: moduleName }, function (error, result) {
        if (error) {
            console.error("Bungee compile error: " + error.line + ": " + error.message);
            console.error(" -- " + error.context);
        } else {
            if (Bungee.verbose || Bungee.debug) {
                console.log("----------------------");
                console.log(result);
                console.log("----------------------");
                console.log("eval...");
                o = new Date();
            }

            eval(result);

            if (Bungee.verbose || Bungee.debug) {
                n = new Date();
                console.log("done, eval took time: ", (n - o), "ms");
            }
        }
    });
};

Bungee.compileScriptTags = function(dom) {
    for (var i = 0; i < window.document.scripts.length; ++i) {
        var script = window.document.scripts[i];
        if (script.type === "text/jmp" || script.type === "text/jump") {
            Bungee.compileScriptTagElement(script);
        }
    }
};

// register in global namespace
module.exports = Bungee;
