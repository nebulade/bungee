/*
 **************************************************
 *  Bungee.js
 *
 *  (c) 2013 Ilkka Oksanen
 *
 *  Bungee may be freely distributed under the MIT license.
 *  For all details and documentation:
 *  http://bungeejs.org
 **************************************************
 */

"use strict";

/*
 **************************************************
 * Simple JavaScript loader.
 **************************************************
 *
 * Note that there is race between the loader and <body onload="Bungee.jump();">
 * Loader probably should call Bungee.jump(). Then built version could have load.js
 * which just does body onload=Bungee.jump() in javascript.
 *
 * But at least with file:// urls, race is not an issue.
 *
 */

(function() {
    var files = ['tokenizer', 'compiler', 'dom', 'animation', 'helper',
                 'engine'];
    var head = document.getElementsByTagName('head')[0];
    var scripts = document.getElementsByTagName('script');
    var loaded = 0;
    var baseUrl = "";

    //First figure out from where bungee.js was loaded
    for (var i = 0; i < scripts.length; i++) {
        var url = scripts[i].src;
        if (url && url.match(/bungee.js$/)) {
            baseUrl = url.replace('bungee.js','');
            break;
        }
    }

    for (var i = 0; i < files.length; i++) {
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = baseUrl + 'src/' + files[i] + '.js';
        script.onload = function () {
            if (++loaded == files.length) {
                console.log('All JavaScript files loaded');
            }
        };

        head.appendChild(script);
    }
}());
