"use strict";

var fs = require('fs');

var quickjs_tokenizer = require('./src/quick_tokenizer.js');
var quickjs_compiler = require('./src/quick_compiler.js');

exports.quick = (function () {
    var ret = {};

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
        var tokens = quickjs_tokenizer.Tokenizer.parse(source);
        quickjs_compiler.Compiler.render(tokens, options, function (error, result) {
            if (error) {
                callback(error);
            } else {
                callback(null, result);
            }
        });
    };

    return ret;
}());
