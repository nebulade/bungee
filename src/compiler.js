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
        output += "this[child.id] = child;\n";
        addIndentation(2);
        output += "for (var i in this.children) {\n";
        addIndentation(2);
        output += "    if (this.children.hasOwnProperty(i)) {\n";
        addIndentation(2);
        output += "        this.children[i][child.id] = child;\n";
        addIndentation(2);
        output += "        child[this.children[i].id] = this.children[i];\n";
        addIndentation(2);
        output += "    }\n";
        addIndentation(2);
        output += "}\n";
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
