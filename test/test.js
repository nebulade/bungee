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
    describe('Comment', function () {
        it('one line', function () {
            var tmp = "";

            tmp += "// Foobar\n";

            var tokens = quick.tokenizer.parse(tmp);
            tokens.should.have.length(0);
        });
        // Not yet supported
        xit('multi line comment', function () {
            var tmp = "";

            tmp += "/*\n";
            tmp += " Foobar \n";
            tmp += " Another line\n";
            tmp += "End line of comment */\n";

            var tokens = quick.tokenizer.parse(tmp);
            tokens.should.have.length(0);
        });
    });

    describe('Basic element', function () {

        function verifyTokens(tokens, data) {
            tokens.should.have.length(data.length);
            for (var i = 0; i < data.length; ++i) {
                tokens[i].TOKEN.should.be.equal(data[i][0]);
                if (data[i][1])
                    tokens[i].DATA.should.be.equal(data[i][1]);
                else
                    should.not.exist(tokens[i].DATA);
            }
        }

        it('empty element', function () {
            var tmp = "";

            tmp += "Element {\n";
            tmp += "}\n";

            var tokens = quick.tokenizer.parse(tmp);
            verifyTokens(tokens, [
                ['ELEMENT', 'Element'],
                ['SCOPE_START', undefined],
                ['SCOPE_END', undefined]
            ]);
        });
        it('empty element one line', function () {
            var tmp = "";

            tmp += "Element {}";

            var tokens = quick.tokenizer.parse(tmp);
            verifyTokens(tokens, [
                ['ELEMENT', 'Element'],
                ['SCOPE_START', undefined],
                ['SCOPE_END', undefined]
            ]);
        });
        it('with one property', function () {
            var tmp = "";

            tmp += "Element {\n";
            tmp += "left: 100;\n";
            tmp += "}\n";

            var tokens = quick.tokenizer.parse(tmp);
            verifyTokens(tokens, [
                ['ELEMENT', 'Element'],
                ['SCOPE_START', undefined],
                ['EXPRESSION', 'left'],
                ['COLON', undefined],
                ['EXPRESSION', '100'],
                ['SCOPE_END', undefined]
            ]);
        });
        it('with multiple integer properties', function () {
            var tmp = "";

            tmp += "Element {\n";
            tmp += "left: 100;\n";
            tmp += "top: -1337;\n";
            tmp += "width: 50;\n";
            tmp += "}\n";

            var tokens = quick.tokenizer.parse(tmp);
            verifyTokens(tokens, [
                ['ELEMENT', 'Element'],
                ['SCOPE_START', undefined],
                ['EXPRESSION', 'left'],
                ['COLON', undefined],
                ['EXPRESSION', '100'],
                ['EXPRESSION', 'top'],
                ['COLON', undefined],
                ['EXPRESSION', '-1337'],
                ['EXPRESSION', 'width'],
                ['COLON', undefined],
                ['EXPRESSION', '50'],
                ['SCOPE_END', undefined]
            ]);
        });
        it('with multiple string properties', function () {
            var tmp = "";

            tmp += "Element {\n";
            tmp += "a: 'foobar';\n";
            tmp += "b: \"baz\";\n";
            tmp += "c: noQuote;\n";
            tmp += "}\n";

            var tokens = quick.tokenizer.parse(tmp);
            verifyTokens(tokens, [
                ['ELEMENT', 'Element'],
                ['SCOPE_START', undefined],
                ['EXPRESSION', 'a'],
                ['COLON', undefined],
                ['EXPRESSION', '\'foobar\''],
                ['EXPRESSION', 'b'],
                ['COLON', undefined],
                ['EXPRESSION', '"baz"'],
                ['EXPRESSION', 'c'],
                ['COLON', undefined],
                ['EXPRESSION', 'noQuote'],
                ['SCOPE_END', undefined]
            ]);
        });
        it('with camel case property', function () {
            var tmp = "";

            tmp += "Element {\n";
            tmp += "myProperty: 2;\n";
            tmp += "}\n";

            var tokens = quick.tokenizer.parse(tmp);
            verifyTokens(tokens, [
                ['ELEMENT', 'Element'],
                ['SCOPE_START', undefined],
                ['EXPRESSION', 'myProperty'],
                ['COLON', undefined],
                ['EXPRESSION', '2'],
                ['SCOPE_END', undefined]
            ]);
        });
        it('with properties containing a number', function () {
            var tmp = "";

            tmp += "Element {\n";
            tmp += "1property: 1;\n";
            tmp += "prop2erty3: 2;\n";
            tmp += "}\n";

            var tokens = quick.tokenizer.parse(tmp);
            verifyTokens(tokens, [
                ['ELEMENT', 'Element'],
                ['SCOPE_START', undefined],
                ['EXPRESSION', '1property'],
                ['COLON', undefined],
                ['EXPRESSION', '1'],
                ['EXPRESSION', 'prop2erty3'],
                ['COLON', undefined],
                ['EXPRESSION', '2'],
                ['SCOPE_END', undefined]
            ]);
        });
        it('with property prefixed with _', function () {
            var tmp = "";

            tmp += "Element {\n";
            tmp += "_prop: 2;\n";
            tmp += "}\n";

            var tokens = quick.tokenizer.parse(tmp);
            verifyTokens(tokens, [
                ['ELEMENT', 'Element'],
                ['SCOPE_START', undefined],
                ['EXPRESSION', '_prop'],
                ['COLON', undefined],
                ['EXPRESSION', '2'],
                ['SCOPE_END', undefined]
            ]);
        });
    });
});

describe('Compiler', function () {
    describe('Compile large jml file', function () {
        it('64000+ lines', function (done) {
            quick.compileFile("large.jml", {}, function (error, result) {
                if (error) {
                    throw(error);
                }

                done();
            });
        });
    });
});
