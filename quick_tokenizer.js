// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved

"use strict";

/*
 **************************************************
 * Tokenizer
 **************************************************
 */
if (!Quick) {
    var Quick = {};
}

if (!Quick.Tokenizer) {
    Quick.Tokenizer = (function () {
        var c, i, line, tokens, bindings, exp, colonOnLine, comment;
        var ret = {};


        // add a found token to the token table
        function addToken (type, data) {
            tokens.push( {"TOKEN" : type, "DATA" : data, "LINE" : line} );
        }

        // extract an element name
        function parseElementName () {
            var token = "";

            while (c) {
                if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'))
                    token += c;
                else
                    break;

                advance();
            }

            return token;
        }

        // extract an expression, can be a property definition, function or right side expression after :
        function parseExpression () {
            var expression = "";

            while (c) {
                if (c === '\n' || c === ';') {
                    i -= 1;
                    break;
                }

                // only break if this is the first colon in that line
                if (!colonOnLine && c === ':') {
                    i -= 1;
                    break;
                }

                // ignore whitespace
                // if ((c !== '\t' && c !== ' ') || expression === "function")
                    expression += c;

                advance();
            }

            return expression;
        }

        // Convenience function to advance the current tokenizer character
        function advance () {
            c = exp[++i];
            return (c);
        }

        /*
         * Parse the input string and create tokens
         */
        ret.parse = function (input) {
            exp = input;
            i = -1;
            line = 1;
            tokens = [];
            c = undefined;//exp[i];
            bindings = [];
            colonOnLine = false;
            comment = false;

            while (advance()) {
                if (comment && c !== '\n')
                    continue;

                // check for one line comments
                if (c === '/' && exp[i+1] === '/') {
                    comment = true;
                    continue;
                }

                if (c === '\n') {
                    comment = false;
                    colonOnLine = false;
                    ++line;
                    continue;
                }

                // check for element name
                if (c >= 'A' && c <= 'Z') {
                    addToken("ELEMENT", parseElementName());
                    continue;
                }

                if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '"' || c === '\'' || c === '(') {
                    addToken("EXPRESSION", parseExpression());
                    continue;
                }

                if (c === '{') {
                    addToken("SCOPE_START");
                    continue;
                }

                if (c === '}') {
                    addToken("SCOPE_END");
                    continue;
                }

                if (c === ':') {
                    colonOnLine = true;
                    addToken("COLON");
                    continue;
                }

                if (c === ';') {
                    colonOnLine = false;
                    addToken("SEMICOLON");
                    continue;
                }
            }

            return tokens;
        }


        /*
         * Print all found tokens on the console
         */
        ret.dumpTokens = function () {
            for (var i = 0; i < tokens.length; ++i)
                console.log("TOKEN: " + tokens[i]["TOKEN"] + " " + (tokens[i]["DATA"] ? tokens[i]["DATA"] : ""));
        }

        return ret;
    }());
}