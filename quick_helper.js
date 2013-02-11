// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved

"use strict";

/*
 **************************************************
 * QuickJS Helper
 **************************************************
 */

// ensure namespace
if (!Quick) {
    var Quick = {};
}

Quick.debug = false;
Quick.verbose = false;

Quick.useQueryFlags = function() {
    // TODO improve detection
    Quick.verbose = (window.location.href.indexOf("verbose") >= 0);
    Quick.debug = (window.location.href.indexOf("debug") >= 0);
};

Quick.compileScriptTagElement = function(script) {
    var tokens = Quick.Tokenizer.parse(script.text);
    Quick.Compiler.render(tokens, function (error, result) {
        if (error) {
            console.log("Error rendering JavaScript on line " + error.line + ": " + error.message);
            console.log(" -- " + error.context);
        } else {
            try {
                console.log("----------------------");
                console.log(result);
                console.log("----------------------");
                console.log("eval...");
                var o = new Date();
                eval(result);
                var n = new Date();
                console.log("done, eval took time: ", (n - o), "ms");
            } catch (e) {
                console.log("Error evaluating generated JS code: " + e);
            }
        }
    });
};

Quick.compileScriptTags = function(scriptType) {
    var type = scriptType ? scriptType : "text/jml";

    for (var i = 0; i < window.document.scripts.length; ++i) {
        var script = window.document.scripts[i];
        if (script.type === type) {
            Quick.compileScriptTagElement(script);
        }
    }
};
