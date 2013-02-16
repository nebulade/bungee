"use strict";

var quick = require('quick');

quick.quick.compileFile("test.jml", function (error, result) {
    console.log(error);
    console.log(result);
});
