"use strict";

var assert = require('assert');
var should = require('should');

var quick = require('../quick');

describe('Quick API has', function () {
    it ('tokenizer', function () {
        should.exist(quick.tokenizer);
    });

    it ('tokenizer parse', function () {
        should.exist(quick.tokenizer.parse);
    });

    it ('compile data', function () {
        should.exist(quick.compile);
    });

    it ('compile file', function () {
        should.exist(quick.compileFile);
    });
});

describe('Tokenizer', function () {
    describe('Basic element', function () {
        it('Empty element', function () {
            var tmp = "";

            tmp += "Element {\n";
            tmp += "}\n";

            var tokens = quick.tokenizer.parse(tmp);
            tokens.should.have.length(5);
            tokens[0].should.have.property('TOKEN');
            tokens[0].TOKEN.should.be.equal('ELEMENT');
        });
    });
});
