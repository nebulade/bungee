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

var tokenizer = (function () {
    var c, i, line, tokens, bindings, exp, colonOnLine, comment, lineContext;
    var ret = {};

    function log (msg) {
        if (Quick.verbose) {
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

    function parseInlineBlock () {
        var block = "";

        advance();

        while (c) {
            // TODO guard i+1
            if (c === '}' && exp[i+1] === '^') {
                advance();
                break;
            }

            block += c;

            advance();
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

            if (c === '\n' || c === ';') {
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

            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '"' || c === '\'' || c === '(' || c === '-' || c === '_') {
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

            if (c === '^' && exp[i+1] === '{') {
                advance();
                addToken("EXPRESSION", parseInlineBlock());
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

        if (Quick.verbose) {
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

// TODO is this the proper check?
if (typeof window === 'undefined') {
    module.exports = tokenizer;
} else {
    window.Quick.Tokenizer = tokenizer;
}

// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved

"use strict";

/*
 **************************************************
 * Compiler
 **************************************************
 */

if (!Quick) {
    var Quick = {};
}

var compiler = (function () {
    // public compiler properties
    var compiler = {};

    // TODO sort out this kindof global variable mess
    var ELEM_PREFIX = "e";      // just a define
    var ELEM_NS = "Quick.";      // main namespace
    var output;                 // output buffer used by all render functions
    var index;                  // index used for tracking the indentation

    var errorCodes = {
        GENERIC:                0,
        UNKNOWN_ELEMENT:        1,
        NO_PROPERTY:            2,
        NO_ELEMENTTYPE:         3,
        NO_TYPENAME:            4,
        NO_EXPRESSION:          5,
        NO_COLON:               6,
        INVALID_PROPERTY_NAME:  7
    };

    // make error codes public
    compiler.errorCodes = errorCodes;

    var errorMessages = [];
    errorMessages[errorCodes.GENERIC] =                 "generic error";
    errorMessages[errorCodes.UNKNOWN_ELEMENT] =         "Cannot create element.";
    errorMessages[errorCodes.NO_PROPERTY] =             "No property to assing expression.";
    errorMessages[errorCodes.NO_ELEMENTTYPE] =          "No type to create an element.";
    errorMessages[errorCodes.NO_TYPENAME] =             "No typename for the new type definition.";
    errorMessages[errorCodes.NO_COLON] =                "Property must be followed by a ':'.";
    errorMessages[errorCodes.NO_EXPRESSION] =           "No right-hand-side expression or element found.";
    errorMessages[errorCodes.INVALID_PROPERTY_NAME] =   "Invalid property name found.";

    function error(code, token) {
        var ret = {};
        ret.code = code;
        ret.context = token ? token.CONTEXT : undefined;
        ret.message = errorMessages[code];
        ret.line = token ? token.LINE : -1;

        return ret;
    }

    function log(msg) {
        if (Quick.verbose) {
            console.log(msg);
        }
    }

    function isNumeric (c) {
        return (c >= '0' && c <= '9');
    }

    /*
     * adds current indentation to compiler output
     */
    function addIndentation(additional) {
        var indentLevel = index + (additional ? additional : 0);
        var i;

        for (i = indentLevel; i; --i) {
            output += "    ";
        }
    }

    /*
     * Renders the head of the javascript output
     * Only called once
     */
    function renderBegin(options) {
        if (Quick.debug) {
            addIndentation(1);
            output += "debugger;\n";
        }

        output += "if (!window.Quick) {\n";
        output += "    window.Quick = {};\n";
        output += "}\n\n";

        if (options.module) {
            output += "window.Quick." + options.module + " = function () {\n";
        } else {
            output += "(function() {\n";
        }
        addIndentation();
        output += "'use strict';\n\n";

        // add pseudo parent
        addIndentation();
        output += "var " + ELEM_PREFIX + " = { \n";
        addIndentation(1);

        output += "children: [],\n";
        addIndentation(1);

        output += "addChild: function(child) {\n";
        addIndentation(2);
        output += ELEM_PREFIX + ".children.push(child);\n";
        addIndentation(2);
        output += "Quick.Engine.addElement(child);\n";
        addIndentation(2);
        output += "return child;\n";
        addIndentation(1);
        output += "},\n";

        addIndentation(1);
        output += "initializeBindings: function() {\n";
        addIndentation(2);
        output += "for (var i = 0; i < " + ELEM_PREFIX + ".children.length; ++i) { " + ELEM_PREFIX + ".children[i].initializeBindings(); }\n";
        addIndentation(1);
        output += "},\n";

        addIndentation(1);
        output += "render: function() {\n";
        addIndentation(2);
        output += "for (var i = 0; i < " + ELEM_PREFIX + ".children.length; ++i) { " + ELEM_PREFIX + ".children[i].render(); }\n";
        addIndentation(1);
        output += "}\n";

        addIndentation();
        output += "};\n\n";
    }

    /*
     * Render the end of the javascript output
     * Only called once
     */
    function renderEnd(options) {
        addIndentation();
        output += ELEM_PREFIX + ".initializeBindings();\n";
        addIndentation();
        output += ELEM_PREFIX + ".render();\n";

        if (options.module) {
            addIndentation();
            output += "return " + ELEM_PREFIX + ";\n";
            output += "};\n";
        } else {
            output += "})();\n";
        }
    }

    /*
     * Renders the start of a new Element instance
     * Called for each element instantiation in jml
     */
    function renderBeginElement(type, id) {
        addIndentation();

        output += ELEM_PREFIX + ".addChild((function() {\n";

        ++index;
        addIndentation();

        output += "var " + ELEM_PREFIX + " = new " + ELEM_NS + type + "(";
        output += id ? "\"" + id + "\"" : "";
        output += ");\n";
    }

    /*
     * Renders the end of a new Element instance
     * Called for each element instantiation in jml
     */
    function renderEndElement() {
        addIndentation();
        output += "return " + ELEM_PREFIX + ";\n";

        --index;
        addIndentation();
        output += "})());\n";
    }

    /*
     * Renders the start of a new Type definition
     * Called for each type in jml
     */
    function renderBeginType(type, inheritedType) {
        addIndentation();

        output += ELEM_NS + type + " = function (id, parent) {\n";

        ++index;
        addIndentation();

        output += "var " + ELEM_PREFIX + " = new " + ELEM_NS + inheritedType + "(id, parent);\n";
    }

    /*
     * Renders the end of a new Type definition
     * Called for each type in jml
     */
    function renderEndType() {
        addIndentation();
        output += "return " + ELEM_PREFIX + ";\n";

        --index;
        addIndentation();
        output += "};\n";
    }

    /*
     * Renders an event handler for the current element/type in scope
     * Event handlers will be generated whenever a property name
     * begins with 'on' like 'onmousedown'
     */
    function renderEventHandler(property, value) {
        addIndentation();
        output += ELEM_PREFIX + ".addEventHandler(\"" + property + "\", ";
        output += "function () {\n";
        addIndentation();
        output += value + "\n";
        addIndentation();
        output += "});\n";
    }

    /*
     * Renders a function for the current element/type in scope
     * Functions will be generated whenever a property name
     * contains a '(', a preceeding 'function ' is not necessary
     * and will be stripped
     */
    function renderFunction(property, value) {
        var name = property.slice(property.indexOf(' ') + 1, property.indexOf('('));
        var args = property.slice(property.indexOf('(') + 1, -1);

        addIndentation();
        output += ELEM_PREFIX + ".addFunction(\"" + name + "\", ";
        output += "function (" + args + ") {\n";
        addIndentation();
        output += value + "\n";
        addIndentation();
        output += "});\n";
    }

    /*
     * Renders a property for the current element/type in scope
     */
    function renderProperty(property, value) {
        // special case for ID
        if (property === "id") {
            return;
        }

        if (property.indexOf('on') === 0) {
            renderEventHandler(property, value);
            return;
        }

        if (property.indexOf('(') !== -1) {
            renderFunction(property, value);
            return;
        }

        addIndentation();
        output += ELEM_PREFIX + ".addProperty(\"" + property + "\", ";
        output += "function () {";
        if (String(value).indexOf("return") !== -1) {
            output += value + " ";
        } else {
            output += "return " + value + ";";
        }
        output += "});\n";
    }

    /*
     * Renders a delegate for the current element/type in scope
     */
    function renderDelegate(property, value) {
        addIndentation();
        output += ELEM_PREFIX + ".create" + property + " = function () {\n";
        addIndentation(1);
        output += "return new " + ELEM_NS + value + "();\n";
        addIndentation();
        output += "}\n";
    }

    /*
     * Takes a TreeObject, containing either a Type or an Element
     * and runs over the object's properties, types and children
     * this is called recoursively
     */
    function renderTreeObject(tree) {
        var i;

        if (tree.typeDefinition) {
            renderBeginType(tree.typeDefinition, tree.type);
        } else {
            renderBeginElement(tree.type, tree.id);
        }

        for (i = 0; i < tree.properties.length; ++i) {
            renderProperty(tree.properties[i].name, tree.properties[i].value);
        }

        for (i = 0; i < tree.delegates.length; ++i) {
            renderDelegate(tree.delegates[i].name, tree.delegates[i].value);
        }

        for (i = 0; i < tree.types.length; ++i) {
            renderTreeObject(tree.types[i]);
        }

        for (i = 0; i < tree.elements.length; ++i) {
            renderTreeObject(tree.elements[i]);
        }

        if (tree.typeDefinition) {
            renderEndType();
        } else {
            renderEndElement();
        }
    }

    /*
     * Starting point of the renderer
     * Takes a TreeObject tree to render
     * The first tree object is root and needs special treatment
     */
    compiler.renderTree = function (tree, options, callback) {
        var i;
        index = 1;
        output = "";

        renderBegin(options);

        for (i = 0; i < tree.types.length; ++i) {
            renderTreeObject(tree.types[i]);
        }

        for (i = 0; i < tree.elements.length; ++i) {
            renderTreeObject(tree.elements[i]);
        }

        renderEnd(options);

        callback(null, output);
    };

    /*
     * Dump out the current object tree to the console
     */
    function dumpObjectTree(tree, indent) {
        var i;

        if (indent === undefined) {
            indent = 0;
        }

        function niceLog(msg) {
            var j;
            var out = "";
            for (j = 0; j < indent; ++j) {
                out += "  ";
            }
            console.log(out + msg);
        }

        niceLog("+ Element:");
        niceLog("|- type: " + tree.type);
        niceLog("|- type definition: " + tree.typeDefinition);

        niceLog("|+ Properties:");
        for (i = 0; i < tree.properties.length; ++i) {
            niceLog("|--> " + tree.properties[i].name);
        }

        niceLog("|+ Delegates:");
        for (i = 0; i < tree.delegates.length; ++i) {
            niceLog("|--> " + tree.delegates[i].name + " : " + tree.delegates[i].value);
        }

        if (tree.types.length) {
            niceLog("|+ Types:");
            for (i = 0; i < tree.types.length; ++i) {
                dumpObjectTree(tree.types[i], indent + 2);
            }
        }

        if (tree.elements.length) {
            niceLog("|+ Elements: ");
            for (i = 0; i < tree.elements.length; ++i) {
                dumpObjectTree(tree.elements[i], indent + 2);
            }
        }
    }

    /*
     * Take all tokens and compile it to a object tree, which can be rendered
     */
    compiler.createObjectTree = function (tok, options, callback) {
        var property;
        var tokens = tok;
        var token_length = tokens.length;
        var elementType;
        var elementTypeDefinition;
        var i, j;

        // TreeObject is a helper to pass information to the renderer
        var TreeObject = function (parent) {
            this.id = undefined;
            this.type = undefined;
            this.typeDefinition = undefined;
            this.parent = parent;
            this.types = [];
            this.elements = [];
            this.properties = [];
            this.delegates = [];
        };

        var objectTreeRoot = new TreeObject();
        objectTreeRoot.type = "RootObject";
        var objectTree = objectTreeRoot;

        for (i = 0; i < token_length; i += 1) {
            var token = tokens[i];

            if (token.TOKEN === "IS_A") {
                if (elementType) {
                    elementTypeDefinition = elementType;
                    elementType = undefined;
                } else {
                    callback(error(errorCodes.NO_TYPENAME, token), null);
                    return;
                }
            }

            if (token.TOKEN === "ELEMENT") {
                elementType = token.DATA;
            }

            if (token.TOKEN === "SCOPE_START") {
                log("start element description");

                // only if elementType was found previously
                if (elementType) {
                    // we found a element definition, so add one to create an element instance
                    var tmp = new TreeObject(objectTree);
                    tmp.type = elementType;

                    // check if we have a type definition or an element
                    if (elementTypeDefinition) {
                        tmp.typeDefinition = elementTypeDefinition;
                        objectTree.types.push(tmp);
                    } else {
                        objectTree.elements.push(tmp);
                    }

                    objectTree = tmp;

                    elementType = undefined;
                    elementTypeDefinition = undefined;
                } else {
                    callback(error(errorCodes.NO_ELEMENTTYPE, token), null);
                }
            }

            if (token.TOKEN === "SCOPE_END") {
                log("end element description");
                // scope end, so reset the objectTree pointer
                objectTree = objectTree.parent;
            }

            if (token.TOKEN === "EXPRESSION") {
                // next token must be COLON
                var next_token = (i + 1 < token_length) ? tokens[i + 1] : undefined;
                if (next_token && next_token.TOKEN === "COLON") {
                    property = token.DATA;
                    log("property found '" + property + "'");
                    // check for valid property names
                    if (isNumeric(property[0])) {
                        log("property name '" + property + "' is invalid.");
                        callback(error(errorCodes.INVALID_PROPERTY_NAME, token), null);
                        return;
                    }
                    i += 1;
                    next_token = undefined;
                } else {
                    callback(error(errorCodes.NO_COLON, token), null);
                    return;
                }

                // next token must be EXPRESSION or ELEMENT
                next_token = (i + 1 < token_length) ? tokens[i + 1] : undefined;
                if (next_token && next_token.TOKEN === "EXPRESSION") {
                    log("right-hand-side expression found for property '" + property + "' '" + next_token.DATA + "'");

                    // special treatment for element IDs they are no real properties
                    if (property === "id") {
                        objectTree.id = next_token.DATA;
                    } else {
                        objectTree.properties.push({name: property, value: next_token.DATA});
                    }
                    i += 1;
                    property = undefined;
                } else if (next_token && next_token.TOKEN === "ELEMENT") {
                    log("right-hand-side element found for property", property, next_token.DATA);
                    objectTree.delegates.push({name: property, value: next_token.DATA});
                    i += 1;
                    property = undefined;
                } else {
                    callback(error(errorCodes.NO_EXPRESSION, next_token), null);
                    return;
                }
            }
        }

        callback(null, objectTreeRoot);
    };

    /*
     * Take all tokens, compile it to a object tree and render it
     * options:
     *  - 'dump'        dump object tree
     */
    compiler.compileAndRender = function (tok, options, callback) {
        compiler.createObjectTree(tok, options, function (error, result) {
            if (error) {
                callback(error, null);
                return;
            }

            if (options.dump) {
                dumpObjectTree(result);
            }

            compiler.renderTree(result, options, callback);
        });
    };

    return compiler;
}());

// TODO is this the proper check?
if (typeof window === 'undefined') {
    module.exports = compiler;
} else {
    window.Quick.Compiler = compiler;
}
// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved
// DOM renderer

"use strict";

if (!Quick) {
    var Quick = {};
}

/*
 **************************************************
 * Predefined basic elements
 **************************************************
 */
Quick.Item = function (id, parent, typeHint) {
    var elem = new Quick.Element(id, parent, typeHint ? typeHint : "item");

    elem.addProperty("className", "");
    elem.addProperty("width", 100);
    elem.addProperty("height", 100);
    elem.addProperty("top", 0);
    elem.addProperty("left", 0);

    elem.addProperty("childrenWidth", function () {
        var left = 0;
        var right = 0;
        var kids = this.children();
        for (var i in kids) {
            if (kids.hasOwnProperty(i)) {
                var c = kids[i];
                if (c.left < left) {
                    left = c.left;
                }
                if ((c.left + c.width) > right) {
                    right = c.left + c.width;
                }
            }
        }

        return (right - left);
    });
    elem.addProperty("childrenHeight", function () {
        var top = 0;
        var bottom = 0;
        var kids = this.children();
        for (var i in kids) {
            if (kids.hasOwnProperty(i)) {
                var c = kids[i];
                if (c.top < top) {
                    top = c.top;
                }
                if ((c.top + c.height) > bottom) {
                    bottom = c.top + c.height;
                }
            }
        }

        return (bottom - top);
    });


    return elem;
};

Quick.InputItem = function (id, parent) {
    var elem = new Quick.Item(id, parent, "InputItem");

    // default to fill parent
    elem.addProperty("width", function () { return this.parent ? this.parent.width : 100; });
    elem.addProperty("height", function () { return this.parent ? this.parent.height : 100; });

    elem.addProperty("mouseAbsX", 0);
    elem.addProperty("mouseAbsY", 0);
    elem.addProperty("mouseRelX", 0);
    elem.addProperty("mouseRelY", 0);
    elem.addProperty("mouseRelStartX", 0);
    elem.addProperty("mouseRelStartY", 0);
    elem.addProperty("mousePressed", false);
    elem.addProperty("containsMouse", false);

    // scrolling
    elem.addProperty("scrollTop", 0);
    elem.addProperty("scrollLeft", 0);
    elem.addProperty("srollWidth", 0);
    elem.addProperty("scrollHeight", 0);

    return elem;
};

// FIXME global leak
var tmpTextElement;
Quick.Text = function (id, parent) {
    var elem = new Quick.Item(id, parent);

    elem.addProperty("mouseEnabled", false);
    elem.addProperty("textWidth", 0);
    elem.addProperty("textHeight", 0);
    elem.addProperty("fontSize", "");
    elem.addProperty("fontFamily", "");
    elem.addProperty("text", "");
    elem.addProperty("-text", function () { return this.text; });
    elem.addProperty("width", function() { return this.textWidth; });
    elem.addProperty("height", function() { return this.textHeight; });

    // all this below for calculating the text width
    if (!tmpTextElement) {
        tmpTextElement = window.document.createElement("div");
        tmpTextElement.style.position = "absolute";
        tmpTextElement.style.visibility = "hidden";
        tmpTextElement.style.width = "auto";
        tmpTextElement.style.height = "auto";
        tmpTextElement.style.left = -10000;
        document.body.appendChild(tmpTextElement);
    }

    function relayout() {
        var tmpProperty = elem.text;
        var width = 0;
        var height = 0;

        tmpTextElement.style.fontSize = elem.fontSize;
        tmpTextElement.style.fontFamily = elem.fontFamily;

        if (tmpTextElement.innerHTML === tmpProperty) {
            width = (tmpTextElement.clientWidth + 1);
            height = (tmpTextElement.clientHeight + 1);
        } else if (tmpProperty !== "") {
            tmpTextElement.innerHTML = tmpProperty;
            width = (tmpTextElement.clientWidth + 1);
            height = (tmpTextElement.clientHeight + 1);
        }

        elem.textWidth = width;
        elem.textHeight = height;
    }

    elem.addChanged("text", relayout);

    return elem;
};

Quick.Window = function (id, parent) {
    var elem = new Quick.Element(id, parent);
    elem.addProperty("innerWidth", window.innerWidth);
    elem.addProperty("innerHeight", window.innerHeight);

    elem.addEventHandler("load", function () {
        var that = this;
        window.addEventListener("resize", function (event) {
            that.innerWidth = event.srcElement.innerWidth;
            that.innerHeight = event.srcElement.innerHeight;
        });
    });

    return elem;
};

Quick.Rectangle = function (id, parent) {
    var elem = new Quick.Item(id, parent);

    elem.addProperty("backgroundColor", "white");
    elem.addProperty("borderColor", "black");
    elem.addProperty("borderStyle", "solid");
    elem.addProperty("borderWidth", 1);
    elem.addProperty("borderRadius", 0);

    return elem;
};

Quick.Image = function (id, parent) {
    var elem = new Quick.Item(id, parent);

    elem.addProperty("textAlign", "center");
    elem.addProperty("src", "image.png");
    elem.addProperty("backgroundImage", function () {
        if (this.src.indexOf("url('") === 0) {
            return this.src;
        }

        return "url('" + this.src + "')";
    });

    return elem;
};

Quick.Input = function (id, parent) {
    var elem = new Quick.Item(id, parent, "input");

    elem.addProperty("-webkit-user-select", "auto");
    elem.addProperty("userSelect", "auto");
    elem.addProperty("text", function() {
        return this.element.value;
    });
    elem.addProperty("placeholder", "");

    return elem;
};

/*
 **************************************************
 * DOM renderer
 **************************************************
 */
Quick.RendererDOM = function () {
    this.currentMouseElement = undefined;
};

Quick.RendererDOM.prototype.createElement = function (typeHint, object) {
    var elem;
    var that = this;

    if (typeHint === 'input') {
        elem = document.createElement('input');
    } else {
        elem = document.createElement('div');
        elem.style.position = 'absolute';
    }

    // set id attribute
    if (object.id) {
        elem.id = object.id;
    }

    function handleTouchStartEvents(event) {
        that.currentMouseElement = this;
        object.mousePressed = true;
        object.emit('mousedown');
    }

    function handleTouchEndEvents(event) {
        object.mousePressed = false;
        object.mouseRelStartX = 0;
        object.mouseRelStartY = 0;
        object.emit('mouseup');
        if (that.currentMouseElement === this) {
            object.emit('activated');
        }
        that.currentMouseElement = undefined;
    }

    function handleTouchMoveEvents(event) {
        object.mouseAbsX = event.clientX || event.targetTouches[0].clientX;
        object.mouseAbsY = event.clientY || event.targetTouches[0].clientY;
        object.mouseRelX = event.layerX || event.targetTouches[0].layerX;
        object.mouseRelY = event.layerY || event.targetTouches[0].layerY;
        object.emit('mousemove');
    }

    function handleMouseDownEvents(event) {
        if (!event.used) {
            that.currentMouseElement = this;
            event.used = true;
        }
        object.mousePressed = true;
        object.mouseRelStartX = event.layerX;
        object.mouseRelStartY = event.layerY;
        object.emit('mousedown');
    }

    function handleMouseUpEvents(event) {
        object.mousePressed = false;
        object.mouseRelStartX = 0;
        object.mouseRelStartY = 0;
        object.emit('mouseup');

        if (that.currentMouseElement === this) {
            object.emit('activated');
        }
        that.currentMouseElement = undefined;
    }

    function handleMouseMoveEvents(event) {
        object.mouseAbsX = event.clientX;
        object.mouseAbsY = event.clientY;
        object.mouseRelX = event.layerX;
        object.mouseRelY = event.layerY;
        object.emit('mousemove');
    }

    function handleMouseOverEvents(event) {
        object.containsMouse = true;
        object.emit('mouseover');
    }

    function handleMouseOutEvents(event) {
        object.containsMouse = false;
        object.emit('mouseout');
    }

    function handleScrollEvents(event) {
        object.scrollTop = event.target.scrollTop;
        object.scrollLeft = event.target.scrollLeft;
        object.srollWidth = event.target.scrollWidth;
        object.scrollHeight = event.target.scrollHeight;
    }

    if (typeHint === "InputItem") {
        elem.addEventListener("scroll", handleScrollEvents, false);

        if ('ontouchstart' in document.documentElement) {
            if (window.navigator.msPointerEnabled) {
                elem.addEventListener("MSPointerDown", handleTouchStartEvents, false);
                elem.addEventListener("MSPointerMove", handleTouchMoveEvents, false);
                elem.addEventListener("MSPointerUp", handleTouchEndEvents, false);
            } else {
                elem.addEventListener("touchstart", handleTouchStartEvents, false);
                elem.addEventListener("touchmove", handleTouchMoveEvents, false);
                elem.addEventListener("touchend", handleTouchEndEvents, false);
            }
        } else {
            elem.addEventListener("mousedown", handleMouseDownEvents, false);
            elem.addEventListener("mouseup", handleMouseUpEvents, false);
            elem.addEventListener("mousemove", handleMouseMoveEvents, false);
            elem.addEventListener("mouseover", handleMouseOverEvents, false);
            elem.addEventListener("mouseout", handleMouseOutEvents, false);
        }
    }

    return elem;
};

Quick.RendererDOM.prototype.addElement = function (element, parent) {
    // in case we have no visual element, just return
    if (!element.element) {
        return;
    }

    if (parent && parent.element) {
        parent.element.appendChild(element.element);
    } else {
        document.body.appendChild(element.element);
    }
};

Quick.RendererDOM.prototype.removeElement = function (element, parent) {
    // in case we have no visual element, just return
    if (!element.element) {
        return;
    }

    if (parent && parent.element) {
        parent.element.removeChild(element.element);
    } else {
        document.body.removeChild(element.element);
    }
};

Quick.RendererDOM.prototype.addElements = function (elements, parent) {
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < elements.length; ++i) {
        if (!elements[i].element) {
            continue;
        }

        fragment.appendChild(elements[i].element);
    }

    if (parent && parent.element) {
        parent.element.appendChild(fragment);
    } else {
        document.body.appendChild(fragment);
    }
};

Quick.RendererDOM.prototype.renderElement = function (element) {
    // console.log("renderElement: " + element.id + " properties: " + Object.keys(element.properties).length);
    var name;

    // in case we have no visual element, just return
    if (!element.element) {
        return;
    }

    for (name in element._dirtyProperties) {
        // ignore properties prefixed with _
        if (name[0] === '_') {
            continue;
        }

        if (name === '-text') {
            element.element.innerHTML = element[name];
        } else if (name === 'placeholder') {
            element.element.placeholder = element[name];
        } else if (name === 'className' && element[name] !== '') {
            element.element.className = element[name];
        } else if (name === 'scale') {
            var s = element.scale.toFixed(10);
            var tmp = "scale(" + s + ", " + s + ")";
            element.element.style['-webkit-transform'] = tmp;
            element.element.style['transform'] = tmp;
        } else {
            element.element.style[name] = element[name];
        }
    }
    element._dirtyProperties = {};
};
// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved
// Animation

"use strict";

if (!Quick) {
    var Quick = {};
}

Quick._animationIndex = 0;
Quick._debugAnimation = true;

/*
 **************************************************
 * Basic Animation
 **************************************************
 */
Quick.Step = function (id, parent) {
    var elem = new Quick.Element(id, parent, "object");

    elem.addProperty("percentage", 0);

    return elem;
};

Quick.Animation = function (id, parent) {
    var elem = new Quick.Element(id, parent, "object");
    var index = Quick._animationIndex++;
    var dirty = true;
    var hasRules = false;
    var animationName = "quickAnimation" + index;
    var keyFramesName = "quickAnimationKeyFrames" + index;

    elem.addProperty("target", function () { return this.parent; });
    elem.addProperty("duration", 250);
    elem.addProperty("delay", 0);
    elem.addProperty("loops", 1);
    elem.addProperty("reverse", false);
    elem.addProperty("easing", "ease");

    function animationStart(event) {
        Quick._debugAnimation && console.log("start", event);
        elem.emit("started");
    }

    function animationIteration(event) {
        Quick._debugAnimation && console.log("iteration", event);
    }

    function animationEnd(event) {
        Quick._debugAnimation && console.log("end", event);
        elem.stop();
        elem.emit("finished");
    }

    function updateRules() {
        var rule1 = "";
        var rule2 = "";
        var rule3 = "";
        var rule4 = "";

        if (!Quick._style) {
            Quick._style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(Quick._style);
        }

        if (hasRules) {
            var tmpName = "." + animationName;
            var i;

            // remove key frames rule
            for (i = 0; i < Quick._style.sheet.cssRules.length; ++i) {
                if (Quick._style.sheet.cssRules[i].name === keyFramesName) {
                    Quick._style.sheet.deleteRule(i);
                    break;
                }
            }

            // remove animation rule
            for (i = 0; i < Quick._style.sheet.cssRules.length; ++i) {
                if (Quick._style.sheet.cssRules[i].selectorText === tmpName) {
                    Quick._style.sheet.deleteRule(i);
                    break;
                }
            }
        }

        rule1 += "." + animationName + " {\n";
        rule1 += "   animation: ";
        rule1 += keyFramesName + " ";
        rule1 += elem.duration + "ms ";
        rule1 += elem.easing + " ";
        rule1 += elem.delay + " ";
        rule1 += elem.loops + " ";
        rule1 += (elem.reverse ? "alternate" : "normal") + ";\n";
        rule1 += "   -webkit-animation: ";
        rule1 += keyFramesName + " ";
        rule1 += elem.duration + "ms ";
        rule1 += elem.easing + " ";
        rule1 += elem.delay + " ";
        rule1 += elem.loops + " ";
        rule1 += (elem.reverse ? "alternate" : "normal") + ";\n";
        rule1 += "}\n";

        rule2 += "@keyframes " + keyFramesName + " { \n";
        rule3 += "@-webkit-keyframes " + keyFramesName + " { \n";
        for (var j in elem.children()) {
            var child = elem.children()[j];

            if (typeof child.percentage === 'undefined') {
                continue;
            }

            rule2 += "   " + child.percentage + "% {\n";
            rule3 += "   " + child.percentage + "% {\n";

            for (var property in child._properties) {
                if (child.hasOwnProperty(property) && property !== 'percentage') {
                    rule2 += "      " + property + ": " + child[property] + ";\n";
                    rule3 += "      " + property + ": " + child[property] + ";\n";
                }
            }

            rule2 += "   }\n";
            rule3 += "   }\n";
        }
        rule2 += "}\n";
        rule3 += "}\n";

        Quick._debugAnimation && console.log("Quick Animation rules:\n", rule2, rule3, rule1);

        try {
            Quick._style.sheet.insertRule(rule3, Quick._style.sheet.rules.length);
        } catch (e) {
            Quick._debugAnimation && console.error("Quick Animation rule", rule3, "could not be inserted.", e);
        }

        try {
            Quick._style.sheet.insertRule(rule2, Quick._style.sheet.rules.length);
        } catch (e) {
            Quick._debugAnimation && console.error("Quick Animation rule", rule2, "could not be inserted.", e);
        }

        try {
            Quick._style.sheet.insertRule(rule1, Quick._style.sheet.rules.length);
        } catch (e) {
            Quick._debugAnimation && console.error("Quick Animation rule", rule1, "could not be inserted.", e);
        }

        hasRules = true;
    }

    function addEventListeners() {
        elem._element = elem.target;
        if (elem._element && elem._element.element) {
            elem._element.element.addEventListener("webkitAnimationStart", animationStart, false);
            elem._element.element.addEventListener("webkitAnimationIteration", animationIteration, false);
            elem._element.element.addEventListener("webkitAnimationEnd", animationEnd, false);
        }
    }

    function markDirty() {
        dirty = true;
    }

    elem.addChanged("target", addEventListeners);
    elem.addChanged("changed", markDirty);

    elem.start = function () {
        if (dirty) {
            updateRules();
            dirty = false;
        }

        if (elem._element)
            elem._element.className = animationName;
    };

    elem.stop = function () {
        elem._element.className = "";
    };

    elem.restart = function () {
        elem.stop();
        elem.start();
    };

    return elem;
};


Quick.Behavior = function (id, parent) {
    var elem = new Quick.Element(id, parent, "object");
    var index = Quick._animationIndex++;
    var hasRules = false;
    var animationName = "quickAnimation" + index;

    elem.addProperty("target", function () { return this.parent; });

    function animationStart(event) {
        Quick._debugAnimation && console.log("start", event);
        elem.emit("started");
    }

    function animationIteration(event) {
        Quick._debugAnimation && console.log("iteration", event);
    }

    function animationEnd(event) {
        Quick._debugAnimation && console.log("end", event);
        elem.stop();
        elem.emit("finished");
    }

    function updateRules() {
        var rule = "";
        var rulepart = "";
        var gotProperties = false;

        if (!Quick._style) {
            Quick._style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(Quick._style);
        }

        if (hasRules) {
            var tmpName = "." + animationName;
            var i;

            // remove animation rule
            for (i = 0; i < Quick._style.sheet.cssRules.length; ++i) {
                if (Quick._style.sheet.cssRules[i].selectorText === tmpName) {
                    Quick._style.sheet.deleteRule(i);
                    break;
                }
            }
        }

        // nothing to do when we got no properties
        if (elem._properties.length === 0) {
            return;
        }

        // create shared parts of the css
        for (var property in elem._properties) {
            if (elem.hasOwnProperty(property) && property !== 'target') {
                if (gotProperties) {
                    rulepart += ", ";
                } else {
                    gotProperties = true;
                }

                rulepart += property + " " + elem[property];
            }
        }

        rule += "." + animationName + " {\n";
        rule += "   -webkit-transition: " + rulepart + ";\n";
        rule += "   transition: " + rulepart + ";\n";
        rule += "}\n";

        // only actually insert rules if there is no property undefined
        if (gotProperties && rule.indexOf('undefined') === -1) {
            Quick._debugAnimation && console.log("Quick Behavior rule", rule);

            try {
                Quick._style.sheet.insertRule(rule, Quick._style.sheet.rules.length);
            } catch (e) {
                Quick._debugAnimation && console.error("Quick Animation rule", rule, "could not be inserted.", e);
            }
            hasRules = true;
        }
    }

    function addEventListeners() {
        elem._element = elem.target;
        if (elem._element && elem._element.element) {
            elem._element.element.addEventListener("webkitAnimationStart", animationStart, false);
            elem._element.element.addEventListener("webkitAnimationIteration", animationIteration, false);
            elem._element.element.addEventListener("webkitAnimationEnd", animationEnd, false);
            elem._element.className = animationName;
        }
    }

    elem.addChanged("target", addEventListeners);
    elem.addChanged("changed", updateRules);

    return elem;
};
// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved

"use strict";

/*
 **************************************************
 * QuickJS Helper
 **************************************************
 */

// ensure namespace
if (!Quick) {
    var Quick = {};
}

Quick.debug = false;
Quick.verbose = false;

Quick.run = function () {
    Quick.useQueryFlags();
    Quick.compileScriptTags();
    Quick.Engine.start();
};

Quick.useQueryFlags = function() {
    // TODO improve detection
    Quick.verbose = (window.location.href.indexOf("verbose") >= 0);
    Quick.debug = (window.location.href.indexOf("debug") >= 0);
};

Quick.compileScriptTagElement = function(script) {
    var tokens = Quick.Tokenizer.parse(script.text);
    Quick.Compiler.compileAndRender(tokens, {}, function (error, result) {
        if (error) {
            console.error("QuickJS compile error: " + error.line + ": " + error.message);
            console.error(" -- " + error.context);
        } else {
            try {
                if (Quick.verbose || Quick.debug) {
                    console.log("----------------------");
                    console.log(result);
                    console.log("----------------------");
                    console.log("eval...");
                    var o = new Date();
                    eval(result);
                    var n = new Date();
                    console.log("done, eval took time: ", (n - o), "ms");
                } else {
                    eval(result);
                }
            } catch (e) {
                console.error("QuickJS error in generated JavaScript: " + e);
                console.error(e);
            }
        }
    });
};

Quick.compileScriptTags = function(scriptType) {
    var type = scriptType ? scriptType : "text/jml";

    for (var i = 0; i < window.document.scripts.length; ++i) {
        var script = window.document.scripts[i];
        if (script.type === type) {
            Quick.compileScriptTagElement(script);
        }
    }
};
// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved

"use strict";

/*
 **************************************************
 * Singleton engine
 **************************************************
 *
 * Handles mainly toplevel elements and detects bindings.
 * This should contain as less as possible!
 *
 */

if (!Quick) {
    var Quick = {};
}

 // animation frame shim
window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
}());

// create main singleton object
if (!Quick.Engine) {
    Quick.Engine = (function () {
        var ret = {};
        var getterCalled = {};
        var _dirtyElements = {};

        ret.magicBindingState = false;
        ret.verbose = false;
        ret._elementIndex = 0;

        function log(msg, error) {
            if (ret.verbose || error) {
                console.log("[Quick.Engine] " + msg);
            }
        }

        // try to create a renderer backend, currently on DOM supported
        try {
            var renderer = new Quick.RendererDOM();
            ret.createElement = renderer.createElement;
            ret.addElement = renderer.addElement;
            ret.addElements = renderer.addElements;
            ret.renderElement = renderer.renderElement;
            ret.removeElement = renderer.removeElement;
        } catch (e) {
            log("Cannot create DOM renderer", true);
            ret.createElement = function () {};
            ret.addElements = function () {};
            ret.addElement = function () {};
            ret.renderElement = function () {};
            ret.removeElement = function () {};
        }

        // begin binding detection
        ret.enterMagicBindingState = function () {
            log("enterMagicBindingState");
            getterCalled = {};
            ret.magicBindingState = true;
        };

        // end binding detection
        ret.exitMagicBindingState = function () {
            log("exitMagicBindingState\n\n");
            ret.magicBindingState = false;
            return getterCalled;
        };

        ret.addCalledGetter = function (element, property) {
            getterCalled[element.id + "." + property] = { element: element, property: property };
        };

        // TODO should be part of the dom renderer?
        var rendering = false;
        var fps = {};
        fps.d = new Date();
        fps.l = 0;

        function advance() {
            if (!rendering) {
                return;
            }

            window.requestAnimFrame(advance);

            for (var i in _dirtyElements) {
                _dirtyElements[i].render();
            }
            _dirtyElements = {};

            if (Quick.verbose) {
                if ((new Date() - fps.d) >= 2000) {
                    console.log("FPS: " + fps.l / 2.0);
                    fps.d = new Date();
                    fps.l = 0;
                } else {
                    ++(fps.l);
                }
            }
        }

        ret.start = function () {
            rendering = true;
            advance();
        };

        ret.stop = function () {
            rendering = false;
        };

        ret.dirty = function (element, property) {
            element._dirtyProperties[property] = true;
            if (!_dirtyElements[element._internalIndex]) {
                _dirtyElements[element._internalIndex] = element;
            }
        };

        return ret;
    }());
}

/*
 **************************************************
 * Basic Element
 **************************************************
 *
 * The main element, which handles its connections
 * and properties. It also calls into the renderer
 * by using render hooks.
 *
 */
Quick.Element = function (id, parent, typeHint) {
    this.id = id;
    this.typeHint = typeHint;
    this.parent = parent;

    if (typeHint !== "object") {
        this.element = Quick.Engine.createElement(typeHint, this);
    } else {
        this.element = null;
    }

    // internal use only
    this._internalIndex = Quick.Engine._elementIndex++;
    this._dirtyProperties = {};
    this._properties = {};
    this._connections = {};
    this._children = {};
    this._bound = {};

    if (this.parent) {
        this.parent.addChild(this);
    }
};

Quick.Element.prototype.children = function () {
    if (Quick.Engine.magicBindingState) {
        Quick.Engine.addCalledGetter(this, 'children');
    }

    return this._children;
};

// TODO both removes need to break the bindings for the children as well
Quick.Element.prototype.removeChild = function(child) {
    Quick.Engine.removeElement(child, this);
    delete this._children[child._internalIndex];

    this.emit("children");
};

Quick.Element.prototype.removeChildren = function () {
    var i;
    for (i in this._children) {
        if (this._children.hasOwnProperty(i)) {
            // TODO do we leak things here? elements are still referenced so maybe a delete?
            Quick.Engine.removeElement(this._children[i], this);
        }
    }

    this._children = {};

    this.emit("children");
};

Quick.Element.prototype.addChild = function (child) {
    // adds child id to the namespace
    this[child.id] = child;

    // adds the parents id to the child
    child[this.id] = this;

    // add child to siblings scope and vice versa
    var i;
    for (i in this._children) {
        if (this._children.hasOwnProperty(i)) {
            this._children[i][child.id] = child;
            child[this._children[i].id] = this._children[i];
        }
    }

    // add newly added child to internal children array
    this._children[child._internalIndex] = child;

    child.parent = this;
    Quick.Engine.addElement(child, this);
    this.emit("children");

    return child;
};

Quick.Element.prototype.render = function () {
    Quick.Engine.renderElement(this);
};

Quick.Element.prototype.addChanged = function (signal, callback) {
    if (!this._connections[signal]) {
        this._connections[signal] = [];
    }

    this._connections[signal][this._connections[signal].length] = callback;
    // console.log("connections for " + signal + " " + this._connections[signal].length);
};

Quick.Element.prototype.removeChanged = function (obj, signal) {
    var signalConnections = this._connections[signal];
    // check if there are any connections for this signal
    if (!signalConnections) {
        return;
    }

    for (var i = 0; i < signalConnections.length; ++i) {
        // TODO do implementation
    }
};

Quick.Element.prototype.addBinding = function (name, value) {
    var that = this;
    var hasBinding = false;

    // FIXME does not catch changing conditions in expression
    //  x: mouseArea.clicked ? a.y() : b:z();
    Quick.Engine.enterMagicBindingState();
    var val = value.apply(this);
    var getters = Quick.Engine.exitMagicBindingState();

    this.breakBindings(name);

    var bindingFunction = function() {
        that[name] = value.apply(that);
    };

    // store found bindings
    for (var getter in getters) {
        if (getters.hasOwnProperty(getter)) {
            var tmp = getters[getter];
            // store bindings to this for breaking
            this._bound[name][this._bound[name].length] = {
                element: tmp.element,
                property: tmp.property
            };

            tmp.element.addChanged(tmp.property, bindingFunction);
            hasBinding = true;
        }
    }

    return { hasBindings: hasBinding, value: val };
};

Quick.Element.prototype.addEventHandler = function (event, handler) {
    var that = this;
    var signal = event;

    if (signal === "" || typeof handler !== 'function') {
        return;
    }

    if (signal.indexOf('on') === 0) {
        signal = signal.slice(2);
    }

    this.addChanged(signal, function () {
        handler.apply(that);
    });
};

// Breaks all bindings assigned to this property
Quick.Element.prototype.breakBindings = function (name) {
    // break all previous bindings
    if (this._bound[name]) {
        for (var i = 0; i < this._bound[name].length; ++i) {
            this._bound[name][i].element.removeChanged(this, name);
        }
    }
    this._bound[name] = [];
};

// This allows to set the property without emit the change
// Does not break the binding!
Quick.Element.prototype.setSilent = function (name, value) {
    var setter = this.__lookupSetter__(name);
    if (typeof setter === 'function') {
        setter.call(this, value, true);
    }
};

// This allows to get the property without notify the get
Quick.Element.prototype.getSilent = function (name) {
    var getter = this.__lookupGetter__(name);
    if (typeof getter === 'function') {
        return getter.call(this, true);
    }
};

// This breaks all previous bindings and adds a new binding
Quick.Element.prototype.set = function (name, value) {
    this.breakBindings(name);

    if (typeof value === 'function') {
        var ret = this.addBinding(name, value);
        if (ret.hasBindings) {
            this[name] = value;
        } else {
            this[name] = ret.value;
        }
    } else {
        this[name] = value;
    }
};

Quick.Element.prototype.addFunction = function (name, value) {
    this[name] = value;
};

var defPropCount = 0;
var notdefPropCount = 0;

Quick.Element.prototype.addProperty = function (name, value) {
    var that = this;
    var valueStore;

    // register property
    this._properties[name] = value;

    if (this.hasOwnProperty(name)) {
        this.name = value;
    } else {
        Object.defineProperty(this, name, {
            get: function (silent) {
                // console.log("getter: ", that.id, name);

                if (!silent && Quick.Engine.magicBindingState)
                    Quick.Engine.addCalledGetter(that, name);

                if (typeof valueStore === 'function')
                    return valueStore.apply(that);

                return valueStore;
            },
            set: function (val, silent) {
                // console.log("setter: ", that.id, name, val);
                if (valueStore === val)
                    return;

                valueStore = val;

                // connections are called like the properties
                if (!silent) {
                    that.emit(name);
                    that.emit('changed');
                }

                Quick.Engine.dirty(that, name);
            }
        });
    }
};

// initial set of all properties and binding evaluation
// should only be called once
Quick.Element.prototype.initializeBindings = function () {
    var name, i;
    for (name in this._properties) {
        if (this._properties.hasOwnProperty(name)) {
            var value = this._properties[name];

            // console.log("Element.initializeBindings()", this.id, name, value);

            // initial set and binding discovery
            if (typeof value === 'function') {
                var ret = this.addBinding(name, value);
                if (ret.hasBindings) {
                    this[name] = value;
                } else {
                    this[name] = ret.value;
                }
            } else {
                this[name] = value;
            }
        }
    }

    for (i in this._children) {
        if (this._children.hasOwnProperty(i)) {
            this._children[i].initializeBindings();
        }
    }

    // this calls the onload slot, if defined
    this.emit("load");
};

Quick.Element.prototype.emit = function (signal) {
    if (signal in this._connections) {
        var slots = this._connections[signal];
        for (var slot in slots) {
            if (slots.hasOwnProperty(slot)) {
                slots[slot]();
            }
        }
    }
};
