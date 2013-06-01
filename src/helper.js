// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved

"use strict";

/*
 **************************************************
 * Bungee Helper
 **************************************************
 */

// ensure namespace
if (!Bungee) {
    var Bungee = {};
}

Bungee.debug = false;
Bungee.verbose = false;

Bungee.run = function () {
    Bungee.useQueryFlags();
    Bungee.compileScriptTags();
    Bungee.Engine.start();
};

Bungee.useQueryFlags = function() {
    // TODO improve detection
    Bungee.verbose = (window.location.href.indexOf("verbose") >= 0);
    Bungee.debug = (window.location.href.indexOf("debug") >= 0);
};

Bungee.compileScriptTagElement = function(script) {
    var tokens = Bungee.Tokenizer.parse(script.text);
    var moduleName = script.attributes.module && script.attributes.module.textContent;
    Bungee.Compiler.compileAndRender(tokens, { module: moduleName }, function (error, result) {
        if (error) {
            console.error("Bungee compile error: " + error.line + ": " + error.message);
            console.error(" -- " + error.context);
        } else {
            try {
                if (Bungee.verbose || Bungee.debug) {
                    console.log("----------------------");
                    console.log(result);
                    console.log("----------------------");
                    console.log("eval...");
                    var o = new Date();
                    eval(result);
                    var n = new Date();
                    console.log("done, eval took time: ", (n - o), "ms");
                } else {
                    eval(result);
                }
            } catch (e) {
                console.error("Bungee error in generated JavaScript: ", e);
            }
        }
    });
};

Bungee.compileScriptTags = function(scriptType) {
    var type = scriptType ? scriptType : "text/jml";

    for (var i = 0; i < window.document.scripts.length; ++i) {
        var script = window.document.scripts[i];
        if (script.type === type) {
            Bungee.compileScriptTagElement(script);
        }
    }
};
