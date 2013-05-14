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
        ret.compiler.compileAndRender(tokens, options, function (error, result) {
            callback(error, result);
        });
    };

    return ret;
}());
