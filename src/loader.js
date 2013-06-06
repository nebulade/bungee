//Simple JavaScript loader.
//
//Note that there is race between the loader and <body onload="Bungee.run();">
//Loader probably should call Bungee.run(). Then built version could have load.js
//which just does body onload=Bungee.run() in javascript.
//
//But at least with file:// urls, race is not an issue.
//

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
