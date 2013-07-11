'use strict';

var Bungee = require('./index.js');

Bungee.debug = false;
Bungee.verbose = false;

function ensureEngine(engine) {
    if (!engine) {
        console.log('[Bungee] Using default engine with DOM renderer.');
        engine = new Bungee.Engine(new Bungee.RendererDOM());
    }

    return engine;
}

Bungee.jump = function (engine) {
    engine = ensureEngine(engine);

    Bungee.useQueryFlags();
    Bungee.compileScriptTags(engine);
    engine.start();
};

Bungee.useQueryFlags = function() {
    // TODO improve detection
    Bungee.verbose = (window.location.href.indexOf("verbose") >= 0);
    Bungee.debug = (window.location.href.indexOf("debug") >= 0);
};

Bungee.compileScriptTagElement = function(engine, script) {
    engine = ensureEngine(engine);

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

            var tmp = eval(result);
            console.log(tmp);
            tmp(Bungee, engine);

            if (Bungee.verbose || Bungee.debug) {
                n = new Date();
                console.log("done, eval took time: ", (n - o), "ms");
            }
        }
    });
};

Bungee.compileScriptTags = function(engine, dom) {
    engine = ensureEngine(engine);

    for (var i = 0; i < window.document.scripts.length; ++i) {
        var script = window.document.scripts[i];
        if (script.type === "text/jmp" || script.type === "text/jump") {
            Bungee.compileScriptTagElement(engine, script);
        }
    }
};

console.log(Bungee);

// since we are in the browser, register it into the global namespace
window.Bungee = Bungee;
