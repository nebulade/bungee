/*
 **************************************************
 *  Bungee.js
 *
 *  (c) 2012-2013 Johannes Zellner
 *
 *  Bungee may be freely distributed under the MIT license.
 *  For all details and documentation:
 *  http://bungeejs.org
 **************************************************
*/

"use strict";

/*
 **************************************************
 * Tokenizer
 **************************************************
 */

var esprima = require("esprima");

if (!Bungee) {
    var Bungee = {};
}

var tokenizer = (function () {
    var c, i, line, tokens, bindings, exp, colonOnLine, comment, lineContext;
    var ret = {};

    function log (msg) {
        if (Bungee.verbose) {
            console.log(msg);
        }
    }

    // add a found token to the token table
    function addToken (type, data) {
        tokens.push( {"TOKEN" : type, "DATA" : data, "LINE" : line, "CONTEXT" : lineContext} );
    }

    // extract an element name
    function parseElementName () {
        var token = "";

        while (c) {
            if (c === '\n') {
                i -= 1;
                break;
            }

            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '_' || c === '-')
                token += c;
            else
                break;

            advance();
        }

        // strip trailing ';'
        if (token[token.length-1] === ';') {
            token = token.substring(0, token.length-1);
        }

        return token;
    }

    // extract an expression, can be a property definition, function or right side expression after :
    function parseExpression () {
        var expression = "";

        while (c) {
            if (c === '\n') {
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

        // strip trailing ';'
        if (expression[expression.length-1] === ';') {
            expression = expression.substring(0, expression.length-1);
        }

        return expression;
    }

    function parseInlineBlock () {
        var block = '';
        var script;

        while (c) {
            block += c;

            if (c === '}') {
                try {
                    script = esprima.parse(block, { tolerant: true});
                    break;
                } catch (e) {
                    // block statement parsing failed, force esprima to check for object notation
                    var tmp = "var a = " + block;
                    try {
                        script = esprima.parse(tmp, { tolerant: true});
                        break;
                    } catch (e) {
                    }
                }
            }

            if (c === '\n') {
                ++line;
            }

            advance();
        }

        // if we have a block statement, this means we need to trim the
        // prepending and trailing curly brackets
        if (script && script.body && script.body[0] && script.body[0].type === "BlockStatement") {
            // TODO this looks a bit messy and error prone
            block = block.trim();
            if (block[0] === '{') {
                block = block.slice(1);
            }
            if (block[block.length-1] === '}') {
                block = block.slice(0, block.length-1);
            }
        }

        return block;
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
        lineContext = "";
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
                lineContext = "";

                // add next line so we have a error context to print
                var j = i;
                var tmpChar = exp[++j];

                while(tmpChar) {
                    if (tmpChar === '\n') {
                        break;
                    }
                    lineContext += tmpChar;
                    tmpChar = exp[++j];
                }

                continue;
            }

            // check for element name
            if (c >= 'A' && c <= 'Z') {
                addToken("ELEMENT", parseElementName());
                continue;
            }

            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '"' || c === '\'' || c === '(' || c === '-' || c === '_' || c === '[') {
                addToken("EXPRESSION", parseExpression());
                continue;
            }

            if (c === '{' && tokens[tokens.length-1].TOKEN === "ELEMENT") {
                addToken("SCOPE_START");
                continue;
            }

            if (c === '{') {
                addToken("EXPRESSION", parseInlineBlock());
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

            if (c === '@') {
                addToken("IS_A");
                continue;
            }

            if (c === ';') {
                colonOnLine = false;
                addToken("SEMICOLON");
                continue;
            }
        }

        if (Bungee.verbose) {
            ret.dumpTokens();
        }

        return tokens;
    };


    /*
     * Print all found tokens on the console
     */
    ret.dumpTokens = function () {
        for (var i = 0; i < tokens.length; ++i)
            console.log("TOKEN: " + tokens[i].TOKEN + " " + (tokens[i].DATA ? tokens[i].DATA : ""));
    };

    return ret;
}());

module.exports = tokenizer;
