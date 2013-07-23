;(function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
(function(){'use strict';

var Bungee = require('./index.js');

// since we are in the browser, register it into the global namespace
window.Bungee = Bungee;

})()
},{"./index.js":2}],3:[function(require,module,exports){
// nothing to see here... no file methods for the browser

},{}],2:[function(require,module,exports){
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

var fs = require('fs');

module.exports = (function () {
    var ret = {};

    ret.Tokenizer = require('./src/tokenizer.js');
    ret.Compiler = require('./src/compiler.js');
    ret.Engine = require('./src/engine.js');
    ret.Elements = require('./src/dom.js');
    ret.Animation = require('./src/animation.js');

    function mixin(obj) {
        for (var e in obj) {
            if (obj.hasOwnProperty(e)) {
                ret[e] = obj[e];
            }
        }
    }

    mixin(ret.Engine);
    mixin(ret.Elements);
    mixin(ret.Animation);

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
        var tokens = ret.Tokenizer.parse(source);
        ret.Compiler.compileAndRender(tokens, options, function (error, result) {
            callback(error, result);
        });
    };

    ret.debug = false;
    ret.verbose = false;

    function ensureEngine(engine) {
        if (!engine) {
            console.log('[Bungee] Using default engine with DOM renderer.');
            engine = new ret.Engine(new ret.RendererDOM());
        }

        return engine;
    }

    ret.jump = function (engine) {
        engine = ensureEngine(engine);

        ret.useQueryFlags();
        ret.compileScriptTags(engine);
        engine.start();
    };

    ret.useQueryFlags = function() {
        // TODO improve detection
        ret.verbose = (window.location.href.indexOf("verbose") >= 0);
        ret.debug = (window.location.href.indexOf("debug") >= 0);
    };

    ret.compileScriptTagElement = function(engine, script) {
        engine = ensureEngine(engine);

        var tokens = ret.Tokenizer.parse(script.text);
        var moduleName = script.attributes.module && script.attributes.module.textContent;
        var o, n;

        ret.Compiler.compileAndRender(tokens, { module: moduleName }, function (error, result) {
            if (error) {
                console.error("Bungee compile error: " + error.line + ": " + error.message);
                console.error(" -- " + error.context);
            } else {
                if (ret.verbose || ret.debug) {
                    console.log("----------------------");
                    console.log(result);
                    console.log("----------------------");
                    console.log("eval...");
                    o = new Date();
                }

                if (result.indexOf('module.exports = ') === 0) {
                    if (!ret.Modules) {
                        ret.Modules = {};
                    }

                    result = result.replace('module.exports = ', 'Bungee.Modules.' + moduleName + ' = ');
                    eval(result);
                } else {
                    var tmp = eval(result);
                    tmp(Bungee, engine);
                }

                if (ret.verbose || ret.debug) {
                    n = new Date();
                    console.log("done, eval took time: ", (n - o), "ms");
                }
            }
        });
    };

    ret.compileScriptTags = function(engine, dom) {
        engine = ensureEngine(engine);

        for (var i = 0; i < window.document.scripts.length; ++i) {
            var script = window.document.scripts[i];
            if (script.type === "text/jmp" || script.type === "text/jump") {
                ret.compileScriptTagElement(engine, script);
            }
        }
    };

    return ret;
}());

},{"./src/animation.js":8,"./src/compiler.js":5,"./src/dom.js":7,"./src/engine.js":6,"./src/tokenizer.js":4,"fs":3}],5:[function(require,module,exports){
(function(){/*
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
 * Compiler
 **************************************************
 */

if (!Bungee) {
    var Bungee = {};
}

var compiler = (function () {
    // public compiler properties
    var compiler = {};

    // TODO sort out this kindof global variable mess
    var ELEM_PREFIX = "e";      // just a define
    var ELEM_NS = "Bungee.";      // main namespace
    var ENGINE_VAR = 'BungeeEngine';
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
        INVALID_PROPERTY_NAME:  7,
        UNEXPECTED_END:         8
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
    errorMessages[errorCodes.UNEXPECTED_END] =          "Unexpected end of input.";

    function error(code, token) {
        var ret = {};
        ret.code = code;
        ret.context = token ? token.CONTEXT : undefined;
        ret.message = errorMessages[code];
        ret.line = token ? token.LINE : -1;

        return ret;
    }

    function log(msg) {
        if (Bungee.verbose) {
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
        if (options.module) {
            output += "module.exports = function (Bungee, " + ENGINE_VAR + ") {\n";
        } else {
            output += "(function () { return function (Bungee, " + ENGINE_VAR + ") {\n";
        }

        addIndentation();
        output += "'use strict';\n\n";

        if (Bungee.debug) {
            addIndentation(1);
            output += "debugger;\n";
        }

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
        output += ENGINE_VAR + ".addElement(child);\n";
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
            addIndentation();
            output += "};\n";
            output += "})();\n";
        }
    }

    /*
     * Renders the start of a new Element instance
     * Called for each element instantiation in jump
     */
    function renderBeginElement(type, id) {
        addIndentation();

        output += ELEM_PREFIX + ".addChild((function() {\n";

        ++index;
        addIndentation();

        output += "var " + ELEM_PREFIX + " = new " + ELEM_NS + type + "(";
        output += ENGINE_VAR;
        output += id ? ", \"" + id + "\"" : "";
        output += ");\n";
    }

    /*
     * Renders the end of a new Element instance
     * Called for each element instantiation in jump
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
     * Called for each type in jump
     */
    function renderBeginType(type, inheritedType) {
        addIndentation();

        output += ELEM_NS + type + " = function (engine, id, parent) {\n";

        ++index;
        addIndentation();

        output += "var " + ELEM_PREFIX + " = new " + ELEM_NS + inheritedType + "(engine, id, parent);\n";
    }

    /*
     * Renders the end of a new Type definition
     * Called for each type in jump
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
        output += "return new " + ELEM_NS + value + "(" + ENGINE_VAR + ");\n";
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

        if (objectTree !== objectTreeRoot) {
            callback(error(errorCodes.UNEXPECTED_END, null), null);
            return;
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

module.exports = compiler;

})()
},{}],6:[function(require,module,exports){
/*
 **************************************************
 *  Bungee.js
 *
 *  (c) 2012-2013 Johannes Zellner
 *  (c)      2013 Simon Turvey
 *
 *  Bungee may be freely distributed under the MIT license.
 *  For all details and documentation:
 *  http://bungeejs.org
 **************************************************
 */

"use strict";

var ret = {};

/*
 **************************************************
 * Bungee engine
 **************************************************
 *
 * Handles mainly toplevel elements and detects bindings.
 * This should contain as less as possible!
 *
 */
function Engine(renderer) {
    this.getterCalled = {};
    this._dirtyElements = {};

    this.renderer = renderer;
    this.verbose = false;
    this._elementIndex = 0;

    this.createElement = renderer.createElement;
    this.addElement = renderer.addElement;
    this.addElements = renderer.addElements;
    this.renderElement = renderer.renderElement;
    this.removeElement = renderer.removeElement;

    /**
     * Dynamically replaced function responsible for instrumenting bindings
     * during the binding evaluation stage.
     */
    this.maybeReportGetterCalled = function () {};

    // TODO should be part of the dom renderer?
    this.renderInterval = undefined;
    this.fps = {};
    this.fps.d = Date.now();
    this.fps.l = 0;
}

Engine.prototype.log = function (msg, error) {
    if (this.verbose || error) {
        console.log("[Bungee.Engine] " + msg);
    }
};

// begin binding detection
Engine.prototype.enterMagicBindingState = function () {
    var that = this;

    this.log("enterMagicBindingState");
    this.getterCalled = {};

    this.maybeReportGetterCalled = function (silent, name) {
        if (!silent) {
            that.addCalledGetter(this, name);
        }
    };
};

// end binding detection
Engine.prototype.exitMagicBindingState = function () {
    this.log("exitMagicBindingState\n\n");
    this.maybeReportGetterCalled = function () {};
    return this.getterCalled;
};

Engine.prototype.start = function () {
    var that = this;

    this.renderInterval = window.setInterval(function () {
        that.advance();
    }, 1000/60.0);
};

Engine.prototype.stop = function () {
    window.clearInterval(this.renderInterval);
};

Engine.prototype.dirty = function (element, property) {
    // ignore properties prefixed with _
    if (property[0] === '_') {
        return;
    }

    element._dirtyProperties[property] = true;
    if (!this._dirtyElements[element._internalIndex]) {
        this._dirtyElements[element._internalIndex] = element;
    }
};

Engine.prototype.addCalledGetter = function (element, property) {
    this.getterCalled[element.id + "." + property] = {
        element: element,
        property: property
    };
};

Engine.prototype.advance = function () {
    // cache keys and length as we wont modify the array (see jsperf)
    var keys = Object.keys(this._dirtyElements);
    var keys_length = keys.length;
    for (var i = 0; i < keys_length; ++i) {
        this._dirtyElements[keys[i]].render();
    }
    this._dirtyElements = {};

    if (this.verbose) {
        var fps = this.fps;

        if ((Date.now() - fps.d) >= 2000) {
            console.log("FPS: " + fps.l / 2.0);
            fps.d = Date.now();
            fps.l = 0;
        } else {
            ++(fps.l);
        }
    }
};


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
function Element(engine, id, parent, typeHint) {
    console.assert(engine instanceof Engine);

    this.engine = engine;
    this.id = id;
    this.typeHint = typeHint;
    this.parent = parent;

    if (typeHint !== "object") {
        this.element = this.engine.createElement(typeHint, this);
    } else {
        this.element = null;
    }

    // internal use only
    this._internalIndex = this.engine._elementIndex++;
    this._dirtyProperties = {};
    this._properties = {};
    this._connections = {};
    this._children = {};
    this._bound = {};
    this._isInitialized = false;
    this._initializeBindingsStep = false;

    if (this.parent) {
        this.parent.addChild(this);
    }
}

Element.prototype.children = function () {
    this.engine.maybeReportGetterCalled.call(this, false, 'children');
    return this._children;
};

// TODO both removes need to break the bindings for the children as well
Element.prototype.removeChild = function(child) {
    this.engine.removeElement(child, this);
    delete this._children[child._internalIndex];

    this.emit("children");
};

Element.prototype.removeChildren = function () {
    for (var i in this._children) {
        if (this._children.hasOwnProperty(i)) {
            // TODO do we leak things here? elements are still referenced so maybe a delete?
            this.engine.removeElement(this._children[i], this);
        }
    }

    this._children = {};

    this.emit("children");
};

Element.prototype.addChild = function (child) {
    // adds child id to the namespace
    if (child.id)
        this[child.id] = child;

    // adds the parents id to the child
    if (this.id)
        child[this.id] = this;

    // add child to siblings scope and vice versa
    for (var i in this._children) {
        if (this._children.hasOwnProperty(i)) {
            if (child.id)
                this._children[i][child.id] = child;

            if (this._children[i].id)
                child[this._children[i].id] = this._children[i];
        }
    }

    // add newly added child to internal children array
    this._children[child._internalIndex] = child;

    child.parent = this;
    this.engine.addElement(child, this);
    this.emit("children");

    return child;
};

Element.prototype.render = function () {
    this.engine.renderElement(this);
};

Element.prototype.addChanged = function (signal, callback) {
    if (!this._connections[signal]) {
        this._connections[signal] = [];
    }

    this._connections[signal].push(callback);
    // console.log("connections for " + signal + " " + this._connections[signal].length);
};

Element.prototype.removeChanged = function (obj, signal) {
    var signalConnections = this._connections[signal];
    // check if there are any connections for this signal
    if (!signalConnections) {
        return;
    }

    // TODO do implementation
    // for (var i = 0; i < signalConnections.length; ++i) {
    // }
};

Element.prototype.addBinding = function (name, value, property) {
    var that = this;
    var hasBinding = false;
    var val, getters;
    var bindingFunction;

    // FIXME does not catch changing conditions in expression
    //  x: mouseArea.clicked ? a.y() : b:z();
    this.engine.enterMagicBindingState();

    if (typeof value === 'function') {
        val = value.apply(this);

        bindingFunction = function() {
            that[name] = value.apply(that);
        };
    } else if (typeof value === 'object' && typeof property !== 'undefined') {
        val = value[property];

        bindingFunction = function() {
            that[name] = value[property];
        };
    } else {
        val = value;
    }
    getters = this.engine.exitMagicBindingState();

    this.breakBindings(name);


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

Element.prototype.addEventHandler = function (event, handler) {
    var that = this;
    var signal = event;

    if (signal === "" || typeof handler !== 'function') {
        return;
    }

    if (signal.indexOf('on') === 0) {
        signal = signal.slice(2);
    }

    this.addChanged(signal, function () {
        if (!that._initializeBindingsStep)
            handler.apply(that);
    });
};

// Breaks all bindings assigned to this property
Element.prototype.breakBindings = function (name) {
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
Element.prototype.setSilent = function (name, value) {
    var setter = this.__lookupSetter__(name);
    if (typeof setter === 'function') {
        setter.call(this, value, true);
    }
};

// This allows to get the property without notify the get
Element.prototype.getSilent = function (name) {
    var getter = this.__lookupGetter__(name);
    if (typeof getter === 'function') {
        return getter.call(this, true);
    }
};

// This breaks all previous bindings and adds a new binding
Element.prototype.set = function (name, value) {
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

Element.prototype.addFunction = function (name, value) {
    this[name] = value;
};

var defPropCount = 0;
var notdefPropCount = 0;

Element.prototype.addProperty = function (name, value) {
    var that = this;
    var valueStore;

    // register property
    this._properties[name] = value;

    if (!this.hasOwnProperty(name)) {
        Object.defineProperty(this, name, {
            get: function (silent) {
                // console.log("getter: ", that.id, name);

                this.engine.maybeReportGetterCalled.call(that, silent, name);

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

                this.engine.dirty(that, name);
            }
        });
    }
};

// initial set of all properties and binding evaluation
// can only be called once
Element.prototype.initializeBindings = function (options) {
    var name, i;

    // prevent from multiple initializations
    if (this._isInitialized) {
        return;
    }

    this._isInitialized = true;
    this._initializeBindingsStep = true;

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

    // force property being set on the elements
    if (!options || !options.deferRender) {
        this.render();
    }

    for (i in this._children) {
        if (this._children.hasOwnProperty(i)) {
            this._children[i].initializeBindings(options);
        }
    }

    this._initializeBindingsStep = false;

    // this calls the onload slot, if defined
    this.emit("load");
};

Element.prototype.emit = function (signal) {
    if (signal in this._connections) {
        var slots = this._connections[signal];
        for (var i = 0; i < slots.length; ++i) {
            slots[i].apply();
        }
    }
};

/*
 **************************************************
 * Basic non visual Elements
 **************************************************
 */
function Collection (engine, id, parent) {
    var elem = new Element(engine, id, parent, "object");
    return elem;
}

module.exports = {
    Engine: Engine,
    Element: Element,
    Collection: Collection
};

},{}],7:[function(require,module,exports){
(function(){/*
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
 * DOM Renderer and Elements
 **************************************************
 */

var Bungee = require('./engine.js');

/*
 **************************************************
 * Predefined basic elements
 **************************************************
 */
Bungee.Item = function (engine, id, parent, typeHint) {
    var elem = new Bungee.Element(engine, id, parent, typeHint ? typeHint : "item");

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

Bungee.InputItem = function (engine, id, parent) {
    var elem = new Bungee.Item(engine, id, parent, "InputItem");

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
Bungee.Text = function (engine, id, parent) {
    var elem = new Bungee.Item(engine, id, parent);

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
        window.document.body.appendChild(tmpTextElement);
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

Bungee.Window = function (engine, id, parent) {
    var elem = new Bungee.Element(engine, id, parent);

    elem.addProperty("innerWidth", window.innerWidth);
    elem.addProperty("innerHeight", window.innerHeight);

    elem.addProperty("width", function () { return this.innerWidth; });
    elem.addProperty("height", function () { return this.innerHeight; });

    elem.addEventHandler("load", function () {
        var that = this;
        window.addEventListener("resize", function (event) {
            that.innerWidth = event.srcElement.innerWidth;
            that.innerHeight = event.srcElement.innerHeight;
        });
    });

    return elem;
};

Bungee.Rectangle = function (engine, id, parent) {
    var elem = new Bungee.Item(engine, id, parent);

    elem.addProperty("backgroundColor", "white");
    elem.addProperty("borderColor", "black");
    elem.addProperty("borderStyle", "solid");
    elem.addProperty("borderWidth", 1);
    elem.addProperty("borderRadius", 0);

    return elem;
};

Bungee.BackgroundImage = function (engine, id, parent) {
    var elem = new Bungee.Item(engine, id, parent);

    elem.addProperty("src", "");
    elem.addProperty("backgroundImage", function () {
        if (!this.src) {
            return "";
        }

        if (this.src.indexOf("url('") === 0) {
            return this.src;
        }

        return "url('" + this.src + "')";
    });
    elem.addProperty("backgroundPosition", "center");
    elem.addProperty("backgroundRepeat", "no-repeat");

    return elem;
};

Bungee.Image = function (engine, id, parent) {
    var elem = new Bungee.Item(engine, id, parent, "image");

    elem.addProperty("src", "");
    elem.addProperty("-image-src", function () {
        return this.src;
    });

    return elem;
};

Bungee.Input = function (engine, id, parent) {
    var elem = new Bungee.Item(engine, id, parent, "input");

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
Bungee.RendererDOM = function () {
    this.currentMouseElement = undefined;
};

Bungee.RendererDOM.prototype.createElement = function (typeHint, object) {
    var elem;
    var that = this;

    if (typeHint === 'input') {
        elem = document.createElement('input');
    } else if (typeHint === 'image') {
        elem = document.createElement('img');
    } else {
        elem = document.createElement('div');
    }

    // initialize basic css attributes
    elem.style.position = 'absolute';

    // set id attribute
    if (object.id) {
        elem.id = object.id;
    }

    function handleTouchStartEvents(event) {
        that.currentMouseElement = this;
        if (that.currentScrollElement) {
            that.currentScrollElementTopStart = that.currentScrollElement.scrollTop;
            that.currentScrollElementLeftStart = that.currentScrollElement.scrollLeft;
        }
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
        if (that.currentScrollElement !== object) {
            that.currentScrollElement = object;
            that.currentScrollElementTopStart = event.target.scrollTop;
            that.currentScrollElementLeftStart = event.target.scrollLeft;
        }

        if (Math.abs(that.currentScrollElementTopStart - event.target.scrollTop) > 20 || Math.abs(that.currentScrollElementLeftStart - event.target.scrollLeft) > 20 ) {
            that.currentMouseElement = undefined;
        }

        object.scrollTop = event.target.scrollTop;
        object.scrollLeft = event.target.scrollLeft;
        object.srollWidth = event.target.scrollWidth;
        object.scrollHeight = event.target.scrollHeight;
    }

    elem.addEventListener("scroll", handleScrollEvents, false);

    if (typeHint === "InputItem") {
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

Bungee.RendererDOM.prototype.addElement = function (element, parent) {
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

Bungee.RendererDOM.prototype.removeElement = function (element, parent) {
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

Bungee.RendererDOM.prototype.addElements = function (elements, parent) {
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

Bungee.RendererDOM.prototype.renderElement = function (element) {
    // console.log("renderElement: " + element.id + " properties: " + Object.keys(element.properties).length);
    var name;

    // in case we have no visual element, just return
    if (!element.element) {
        return;
    }

    for (name in element._dirtyProperties) {
        if (name === 'className' && element[name] !== '') {
            element.element.className = element[name];
        } else if (name === 'scale') {
            var s = element.scale.toFixed(10);
            var tmp = "scale(" + s + ", " + s + ")";
            element.element.style['-webkit-transform'] = tmp;
            element.element.style['transform'] = tmp;
        } else if (name === '-text') {
            element.element.innerHTML = element[name];
        } else if (name === '-image-src') {
            element.element.src = element[name];
        } else if (name === 'placeholder') {
            element.element.placeholder = element[name];
        } else {
            element.element.style[name] = element[name];
        }
    }
    element._dirtyProperties = {};
};

module.exports = Bungee;

})()
},{"./engine.js":6}],8:[function(require,module,exports){
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
 * Animation
 **************************************************
 */

var Bungee = require('./engine.js');

Bungee._animationIndex = 0;
Bungee._debugAnimation = false;

/*
 **************************************************
 * Basic Animation
 **************************************************
 */
Bungee.Step = function (engine, id, parent) {
    var elem = new Bungee.Element(engine, id, parent, "object");

    elem.addProperty("percentage", 0);

    return elem;
};

Bungee.Animation = function (engine, id, parent) {
    var elem = new Bungee.Element(engine, id, parent, "object");
    var index = Bungee._animationIndex++;
    var dirty = true;
    var hasRules = false;
    var animationName = "bungeeAnimation" + index;
    var keyFramesName = "bungeeAnimationKeyFrames" + index;

    elem.addProperty("target", function () { return this.parent; });
    elem.addProperty("duration", 250);
    elem.addProperty("delay", 0);
    elem.addProperty("loops", 1);
    elem.addProperty("reverse", false);
    elem.addProperty("easing", "ease");

    function animationStart(event) {
        Bungee._debugAnimation && console.log("start", event);
        elem.emit("started");
    }

    function animationIteration(event) {
        Bungee._debugAnimation && console.log("iteration", event);
    }

    function animationEnd(event) {
        Bungee._debugAnimation && console.log("end", event);
        elem.stop();
        elem.emit("finished");
    }

    function updateRules() {
        var rule1 = "";
        var rule2 = "";
        var rule3 = "";
        var rule4 = "";

        if (!Bungee._style) {
            Bungee._style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(Bungee._style);
        }

        if (hasRules) {
            var tmpName = "." + animationName;
            var i;

            // remove key frames rule
            for (i = 0; i < Bungee._style.sheet.cssRules.length; ++i) {
                if (Bungee._style.sheet.cssRules[i].name === keyFramesName) {
                    Bungee._style.sheet.deleteRule(i);
                    break;
                }
            }

            // remove animation rule
            for (i = 0; i < Bungee._style.sheet.cssRules.length; ++i) {
                if (Bungee._style.sheet.cssRules[i].selectorText === tmpName) {
                    Bungee._style.sheet.deleteRule(i);
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

        Bungee._debugAnimation && console.log("Bungee Animation rules:\n", rule2, rule3, rule1);

        try {
            Bungee._style.sheet.insertRule(rule3, Bungee._style.sheet.rules.length);
        } catch (e) {
            Bungee._debugAnimation && console.error("Bungee Animation rule", rule3, "could not be inserted.", e);
        }

        try {
            Bungee._style.sheet.insertRule(rule2, Bungee._style.sheet.rules.length);
        } catch (e) {
            Bungee._debugAnimation && console.error("Bungee Animation rule", rule2, "could not be inserted.", e);
        }

        try {
            Bungee._style.sheet.insertRule(rule1, Bungee._style.sheet.rules.length);
        } catch (e) {
            Bungee._debugAnimation && console.error("Bungee Animation rule", rule1, "could not be inserted.", e);
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


Bungee.Behavior = function (engine, id, parent) {
    var elem = new Bungee.Element(engine, id, parent, "object");
    var index = Bungee._animationIndex++;
    var hasRules = false;
    var animationName = "bungeeAnimation" + index;

    elem.addProperty("target", function () { return this.parent; });

    function animationStart(event) {
        Bungee._debugAnimation && console.log("start", event);
        elem.emit("started");
    }

    function animationIteration(event) {
        Bungee._debugAnimation && console.log("iteration", event);
    }

    function animationEnd(event) {
        Bungee._debugAnimation && console.log("end", event);
        elem.stop();
        elem.emit("finished");
    }

    function updateRules() {
        var rule = "";
        var rulepart = "";
        var gotProperties = false;

        if (!Bungee._style) {
            Bungee._style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(Bungee._style);
        }

        if (hasRules) {
            var tmpName = "." + animationName;
            var i;

            // remove animation rule
            for (i = 0; i < Bungee._style.sheet.cssRules.length; ++i) {
                if (Bungee._style.sheet.cssRules[i].selectorText === tmpName) {
                    Bungee._style.sheet.deleteRule(i);
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
            Bungee._debugAnimation && console.log("Bungee Behavior rule", rule);

            try {
                Bungee._style.sheet.insertRule(rule, Bungee._style.sheet.rules.length);
            } catch (e) {
                Bungee._debugAnimation && console.error("Bungee Animation rule", rule, "could not be inserted.", e);
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

},{"./engine.js":6}],4:[function(require,module,exports){
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

},{"esprima":9}],9:[function(require,module,exports){
(function(){/*
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint bitwise:true plusplus:true */
/*global esprima:true, define:true, exports:true, window: true,
throwError: true, createLiteral: true, generateStatement: true,
parseAssignmentExpression: true, parseBlock: true, parseExpression: true,
parseFunctionDeclaration: true, parseFunctionExpression: true,
parseFunctionSourceElements: true, parseVariableIdentifier: true,
parseLeftHandSideExpression: true,
parseStatement: true, parseSourceElement: true */

(function (root, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory((root.esprima = {}));
    }
}(this, function (exports) {
    'use strict';

    var Token,
        TokenName,
        Syntax,
        PropertyKind,
        Messages,
        Regex,
        source,
        strict,
        index,
        lineNumber,
        lineStart,
        length,
        buffer,
        state,
        extra;

    Token = {
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8
    };

    TokenName = {};
    TokenName[Token.BooleanLiteral] = 'Boolean';
    TokenName[Token.EOF] = '<end>';
    TokenName[Token.Identifier] = 'Identifier';
    TokenName[Token.Keyword] = 'Keyword';
    TokenName[Token.NullLiteral] = 'Null';
    TokenName[Token.NumericLiteral] = 'Numeric';
    TokenName[Token.Punctuator] = 'Punctuator';
    TokenName[Token.StringLiteral] = 'String';

    Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        BlockStatement: 'BlockStatement',
        BinaryExpression: 'BinaryExpression',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DoWhileStatement: 'DoWhileStatement',
        DebuggerStatement: 'DebuggerStatement',
        EmptyStatement: 'EmptyStatement',
        ExpressionStatement: 'ExpressionStatement',
        ForStatement: 'ForStatement',
        ForInStatement: 'ForInStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SwitchStatement: 'SwitchStatement',
        SwitchCase: 'SwitchCase',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement'
    };

    PropertyKind = {
        Data: 1,
        Get: 2,
        Set: 4
    };

    // Error messages should be identical to V8.
    Messages = {
        UnexpectedToken:  'Unexpected token %0',
        UnexpectedNumber:  'Unexpected number',
        UnexpectedString:  'Unexpected string',
        UnexpectedIdentifier:  'Unexpected identifier',
        UnexpectedReserved:  'Unexpected reserved word',
        UnexpectedEOS:  'Unexpected end of input',
        NewlineAfterThrow:  'Illegal newline after throw',
        InvalidRegExp: 'Invalid regular expression',
        UnterminatedRegExp:  'Invalid regular expression: missing /',
        InvalidLHSInAssignment:  'Invalid left-hand side in assignment',
        InvalidLHSInForIn:  'Invalid left-hand side in for-in',
        MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
        NoCatchOrFinally:  'Missing catch or finally after try',
        UnknownLabel: 'Undefined label \'%0\'',
        Redeclaration: '%0 \'%1\' has already been declared',
        IllegalContinue: 'Illegal continue statement',
        IllegalBreak: 'Illegal break statement',
        IllegalReturn: 'Illegal return statement',
        StrictModeWith:  'Strict mode code may not include a with statement',
        StrictCatchVariable:  'Catch variable may not be eval or arguments in strict mode',
        StrictVarName:  'Variable name may not be eval or arguments in strict mode',
        StrictParamName:  'Parameter name eval or arguments is not allowed in strict mode',
        StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
        StrictFunctionName:  'Function name may not be eval or arguments in strict mode',
        StrictOctalLiteral:  'Octal literals are not allowed in strict mode.',
        StrictDelete:  'Delete of an unqualified identifier in strict mode.',
        StrictDuplicateProperty:  'Duplicate data property in object literal not allowed in strict mode',
        AccessorDataProperty:  'Object literal may not have data and accessor property with the same name',
        AccessorGetSet:  'Object literal may not have multiple get/set accessors with the same name',
        StrictLHSAssignment:  'Assignment to eval or arguments is not allowed in strict mode',
        StrictLHSPostfix:  'Postfix increment/decrement may not have eval or arguments operand in strict mode',
        StrictLHSPrefix:  'Prefix increment/decrement may not have eval or arguments operand in strict mode',
        StrictReservedWord:  'Use of future reserved word in strict mode'
    };

    // See also tools/generate-unicode-regex.py.
    Regex = {
        NonAsciiIdentifierStart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]'),
        NonAsciiIdentifierPart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea\u05f0-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u0800-\u082d\u0840-\u085b\u08a0\u08a2-\u08ac\u08e4-\u08fe\u0900-\u0963\u0966-\u096f\u0971-\u0977\u0979-\u097f\u0981-\u0983\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7\u09c8\u09cb-\u09ce\u09d7\u09dc\u09dd\u09df-\u09e3\u09e6-\u09f1\u0a01-\u0a03\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5c\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c58\u0c59\u0c60-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1\u0cf2\u0d02\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d57\u0d60-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb9\u0ebb-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772\u1773\u1780-\u17d3\u17d7\u17dc\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1877\u1880-\u18aa\u18b0-\u18f5\u1900-\u191c\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19d9\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1cd0-\u1cd2\u1cd4-\u1cf6\u1d00-\u1de6\u1dfc-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u200c\u200d\u203f\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u2e2f\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099\u309a\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua697\ua69f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua827\ua840-\ua873\ua880-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua900-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a\uaa7b\uaa80-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabea\uabec\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]')
    };

    // Ensure the condition is true, otherwise throw an error.
    // This is only to have a better contract semantic, i.e. another safety net
    // to catch a logic error. The condition shall be fulfilled in normal case.
    // Do NOT use this to enforce a certain condition on any user input.

    function assert(condition, message) {
        if (!condition) {
            throw new Error('ASSERT: ' + message);
        }
    }

    function sliceSource(from, to) {
        return source.slice(from, to);
    }

    if (typeof 'esprima'[0] === 'undefined') {
        sliceSource = function sliceArraySource(from, to) {
            return source.slice(from, to).join('');
        };
    }

    function isDecimalDigit(ch) {
        return '0123456789'.indexOf(ch) >= 0;
    }

    function isHexDigit(ch) {
        return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
    }

    function isOctalDigit(ch) {
        return '01234567'.indexOf(ch) >= 0;
    }


    // 7.2 White Space

    function isWhiteSpace(ch) {
        return (ch === ' ') || (ch === '\u0009') || (ch === '\u000B') ||
            (ch === '\u000C') || (ch === '\u00A0') ||
            (ch.charCodeAt(0) >= 0x1680 &&
             '\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF'.indexOf(ch) >= 0);
    }

    // 7.3 Line Terminators

    function isLineTerminator(ch) {
        return (ch === '\n' || ch === '\r' || ch === '\u2028' || ch === '\u2029');
    }

    // 7.6 Identifier Names and Identifiers

    function isIdentifierStart(ch) {
        return (ch === '$') || (ch === '_') || (ch === '\\') ||
            (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
            ((ch.charCodeAt(0) >= 0x80) && Regex.NonAsciiIdentifierStart.test(ch));
    }

    function isIdentifierPart(ch) {
        return (ch === '$') || (ch === '_') || (ch === '\\') ||
            (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
            ((ch >= '0') && (ch <= '9')) ||
            ((ch.charCodeAt(0) >= 0x80) && Regex.NonAsciiIdentifierPart.test(ch));
    }

    // 7.6.1.2 Future Reserved Words

    function isFutureReservedWord(id) {
        switch (id) {

        // Future reserved words.
        case 'class':
        case 'enum':
        case 'export':
        case 'extends':
        case 'import':
        case 'super':
            return true;
        }

        return false;
    }

    function isStrictModeReservedWord(id) {
        switch (id) {

        // Strict Mode reserved words.
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'yield':
        case 'let':
            return true;
        }

        return false;
    }

    function isRestrictedWord(id) {
        return id === 'eval' || id === 'arguments';
    }

    // 7.6.1.1 Keywords

    function isKeyword(id) {
        var keyword = false;
        switch (id.length) {
        case 2:
            keyword = (id === 'if') || (id === 'in') || (id === 'do');
            break;
        case 3:
            keyword = (id === 'var') || (id === 'for') || (id === 'new') || (id === 'try');
            break;
        case 4:
            keyword = (id === 'this') || (id === 'else') || (id === 'case') || (id === 'void') || (id === 'with');
            break;
        case 5:
            keyword = (id === 'while') || (id === 'break') || (id === 'catch') || (id === 'throw');
            break;
        case 6:
            keyword = (id === 'return') || (id === 'typeof') || (id === 'delete') || (id === 'switch');
            break;
        case 7:
            keyword = (id === 'default') || (id === 'finally');
            break;
        case 8:
            keyword = (id === 'function') || (id === 'continue') || (id === 'debugger');
            break;
        case 10:
            keyword = (id === 'instanceof');
            break;
        }

        if (keyword) {
            return true;
        }

        switch (id) {
        // Future reserved words.
        // 'const' is specialized as Keyword in V8.
        case 'const':
            return true;

        // For compatiblity to SpiderMonkey and ES.next
        case 'yield':
        case 'let':
            return true;
        }

        if (strict && isStrictModeReservedWord(id)) {
            return true;
        }

        return isFutureReservedWord(id);
    }

    // 7.4 Comments

    function skipComment() {
        var ch, blockComment, lineComment;

        blockComment = false;
        lineComment = false;

        while (index < length) {
            ch = source[index];

            if (lineComment) {
                ch = source[index++];
                if (isLineTerminator(ch)) {
                    lineComment = false;
                    if (ch === '\r' && source[index] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                }
            } else if (blockComment) {
                if (isLineTerminator(ch)) {
                    if (ch === '\r' && source[index + 1] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    ++index;
                    lineStart = index;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    ch = source[index++];
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                    if (ch === '*') {
                        ch = source[index];
                        if (ch === '/') {
                            ++index;
                            blockComment = false;
                        }
                    }
                }
            } else if (ch === '/') {
                ch = source[index + 1];
                if (ch === '/') {
                    index += 2;
                    lineComment = true;
                } else if (ch === '*') {
                    index += 2;
                    blockComment = true;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    break;
                }
            } else if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch ===  '\r' && source[index] === '\n') {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
            } else {
                break;
            }
        }
    }

    function scanHexEscape(prefix) {
        var i, len, ch, code = 0;

        len = (prefix === 'u') ? 4 : 2;
        for (i = 0; i < len; ++i) {
            if (index < length && isHexDigit(source[index])) {
                ch = source[index++];
                code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            } else {
                return '';
            }
        }
        return String.fromCharCode(code);
    }

    function scanIdentifier() {
        var ch, start, id, restore;

        ch = source[index];
        if (!isIdentifierStart(ch)) {
            return;
        }

        start = index;
        if (ch === '\\') {
            ++index;
            if (source[index] !== 'u') {
                return;
            }
            ++index;
            restore = index;
            ch = scanHexEscape('u');
            if (ch) {
                if (ch === '\\' || !isIdentifierStart(ch)) {
                    return;
                }
                id = ch;
            } else {
                index = restore;
                id = 'u';
            }
        } else {
            id = source[index++];
        }

        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch)) {
                break;
            }
            if (ch === '\\') {
                ++index;
                if (source[index] !== 'u') {
                    return;
                }
                ++index;
                restore = index;
                ch = scanHexEscape('u');
                if (ch) {
                    if (ch === '\\' || !isIdentifierPart(ch)) {
                        return;
                    }
                    id += ch;
                } else {
                    index = restore;
                    id += 'u';
                }
            } else {
                id += source[index++];
            }
        }

        // There is no keyword or literal with only one character.
        // Thus, it must be an identifier.
        if (id.length === 1) {
            return {
                type: Token.Identifier,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (isKeyword(id)) {
            return {
                type: Token.Keyword,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // 7.8.1 Null Literals

        if (id === 'null') {
            return {
                type: Token.NullLiteral,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // 7.8.2 Boolean Literals

        if (id === 'true' || id === 'false') {
            return {
                type: Token.BooleanLiteral,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        return {
            type: Token.Identifier,
            value: id,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    // 7.7 Punctuators

    function scanPunctuator() {
        var start = index,
            ch1 = source[index],
            ch2,
            ch3,
            ch4;

        // Check for most common single-character punctuators.

        if (ch1 === ';' || ch1 === '{' || ch1 === '}') {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === ',' || ch1 === '(' || ch1 === ')') {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // Dot (.) can also start a floating-point number, hence the need
        // to check the next character.

        ch2 = source[index + 1];
        if (ch1 === '.' && !isDecimalDigit(ch2)) {
            return {
                type: Token.Punctuator,
                value: source[index++],
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // Peek more characters.

        ch3 = source[index + 2];
        ch4 = source[index + 3];

        // 4-character punctuator: >>>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            if (ch4 === '=') {
                index += 4;
                return {
                    type: Token.Punctuator,
                    value: '>>>=',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        // 3-character punctuators: === !== >>> <<= >>=

        if (ch1 === '=' && ch2 === '=' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '===',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '!' && ch2 === '=' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '!==',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>>',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '<' && ch2 === '<' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '<<=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '>' && ch2 === '>' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // 2-character punctuators: <= >= == != ++ -- << >> && ||
        // += -= *= %= &= |= ^= /=

        if (ch2 === '=') {
            if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
                index += 2;
                return {
                    type: Token.Punctuator,
                    value: ch1 + ch2,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        if (ch1 === ch2 && ('+-<>&|'.indexOf(ch1) >= 0)) {
            if ('+-<>&|'.indexOf(ch2) >= 0) {
                index += 2;
                return {
                    type: Token.Punctuator,
                    value: ch1 + ch2,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        // The remaining 1-character punctuators.

        if ('[]<>+-*%&|^!~?:=/'.indexOf(ch1) >= 0) {
            return {
                type: Token.Punctuator,
                value: source[index++],
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }
    }

    // 7.8.3 Numeric Literals

    function scanNumericLiteral() {
        var number, start, ch;

        ch = source[index];
        assert(isDecimalDigit(ch) || (ch === '.'),
            'Numeric literal must start with a decimal digit or a decimal point');

        start = index;
        number = '';
        if (ch !== '.') {
            number = source[index++];
            ch = source[index];

            // Hex number starts with '0x'.
            // Octal number starts with '0'.
            if (number === '0') {
                if (ch === 'x' || ch === 'X') {
                    number += source[index++];
                    while (index < length) {
                        ch = source[index];
                        if (!isHexDigit(ch)) {
                            break;
                        }
                        number += source[index++];
                    }

                    if (number.length <= 2) {
                        // only 0x
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }

                    if (index < length) {
                        ch = source[index];
                        if (isIdentifierStart(ch)) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    }
                    return {
                        type: Token.NumericLiteral,
                        value: parseInt(number, 16),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                } else if (isOctalDigit(ch)) {
                    number += source[index++];
                    while (index < length) {
                        ch = source[index];
                        if (!isOctalDigit(ch)) {
                            break;
                        }
                        number += source[index++];
                    }

                    if (index < length) {
                        ch = source[index];
                        if (isIdentifierStart(ch) || isDecimalDigit(ch)) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    }
                    return {
                        type: Token.NumericLiteral,
                        value: parseInt(number, 8),
                        octal: true,
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                }

                // decimal number starts with '0' such as '09' is illegal.
                if (isDecimalDigit(ch)) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            while (index < length) {
                ch = source[index];
                if (!isDecimalDigit(ch)) {
                    break;
                }
                number += source[index++];
            }
        }

        if (ch === '.') {
            number += source[index++];
            while (index < length) {
                ch = source[index];
                if (!isDecimalDigit(ch)) {
                    break;
                }
                number += source[index++];
            }
        }

        if (ch === 'e' || ch === 'E') {
            number += source[index++];

            ch = source[index];
            if (ch === '+' || ch === '-') {
                number += source[index++];
            }

            ch = source[index];
            if (isDecimalDigit(ch)) {
                number += source[index++];
                while (index < length) {
                    ch = source[index];
                    if (!isDecimalDigit(ch)) {
                        break;
                    }
                    number += source[index++];
                }
            } else {
                ch = 'character ' + ch;
                if (index >= length) {
                    ch = '<end>';
                }
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        if (index < length) {
            ch = source[index];
            if (isIdentifierStart(ch)) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    // 7.8.4 String Literals

    function scanStringLiteral() {
        var str = '', quote, start, ch, code, unescaped, restore, octal = false;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        while (index < length) {
            ch = source[index++];

            if (ch === quote) {
                quote = '';
                break;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!isLineTerminator(ch)) {
                    switch (ch) {
                    case 'n':
                        str += '\n';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'u':
                    case 'x':
                        restore = index;
                        unescaped = scanHexEscape(ch);
                        if (unescaped) {
                            str += unescaped;
                        } else {
                            index = restore;
                            str += ch;
                        }
                        break;
                    case 'b':
                        str += '\b';
                        break;
                    case 'f':
                        str += '\f';
                        break;
                    case 'v':
                        str += '\x0B';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            str += String.fromCharCode(code);
                        } else {
                            str += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                }
            } else if (isLineTerminator(ch)) {
                break;
            } else {
                str += ch;
            }
        }

        if (quote !== '') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanRegExp() {
        var str, ch, start, pattern, flags, value, classMarker = false, restore, terminated = false;

        buffer = null;
        skipComment();

        start = index;
        ch = source[index];
        assert(ch === '/', 'Regular expression literal must start with a slash');
        str = source[index++];

        while (index < length) {
            ch = source[index++];
            str += ch;
            if (classMarker) {
                if (ch === ']') {
                    classMarker = false;
                }
            } else {
                if (ch === '\\') {
                    ch = source[index++];
                    // ECMA-262 7.8.5
                    if (isLineTerminator(ch)) {
                        throwError({}, Messages.UnterminatedRegExp);
                    }
                    str += ch;
                } else if (ch === '/') {
                    terminated = true;
                    break;
                } else if (ch === '[') {
                    classMarker = true;
                } else if (isLineTerminator(ch)) {
                    throwError({}, Messages.UnterminatedRegExp);
                }
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnterminatedRegExp);
        }

        // Exclude leading and trailing slash.
        pattern = str.substr(1, str.length - 2);

        flags = '';
        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch)) {
                break;
            }

            ++index;
            if (ch === '\\' && index < length) {
                ch = source[index];
                if (ch === 'u') {
                    ++index;
                    restore = index;
                    ch = scanHexEscape('u');
                    if (ch) {
                        flags += ch;
                        str += '\\u';
                        for (; restore < index; ++restore) {
                            str += source[restore];
                        }
                    } else {
                        index = restore;
                        flags += 'u';
                        str += '\\u';
                    }
                } else {
                    str += '\\';
                }
            } else {
                flags += ch;
                str += ch;
            }
        }

        try {
            value = new RegExp(pattern, flags);
        } catch (e) {
            throwError({}, Messages.InvalidRegExp);
        }

        return {
            literal: str,
            value: value,
            range: [start, index]
        };
    }

    function isIdentifierName(token) {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.NullLiteral;
    }

    function advance() {
        var ch, token;

        skipComment();

        if (index >= length) {
            return {
                type: Token.EOF,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [index, index]
            };
        }

        token = scanPunctuator();
        if (typeof token !== 'undefined') {
            return token;
        }

        ch = source[index];

        if (ch === '\'' || ch === '"') {
            return scanStringLiteral();
        }

        if (ch === '.' || isDecimalDigit(ch)) {
            return scanNumericLiteral();
        }

        token = scanIdentifier();
        if (typeof token !== 'undefined') {
            return token;
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    function lex() {
        var token;

        if (buffer) {
            index = buffer.range[1];
            lineNumber = buffer.lineNumber;
            lineStart = buffer.lineStart;
            token = buffer;
            buffer = null;
            return token;
        }

        buffer = null;
        return advance();
    }

    function lookahead() {
        var pos, line, start;

        if (buffer !== null) {
            return buffer;
        }

        pos = index;
        line = lineNumber;
        start = lineStart;
        buffer = advance();
        index = pos;
        lineNumber = line;
        lineStart = start;

        return buffer;
    }

    // Return true if there is a line terminator before the next token.

    function peekLineTerminator() {
        var pos, line, start, found;

        pos = index;
        line = lineNumber;
        start = lineStart;
        skipComment();
        found = lineNumber !== line;
        index = pos;
        lineNumber = line;
        lineStart = start;

        return found;
    }

    // Throw an exception

    function throwError(token, messageFormat) {
        var error,
            args = Array.prototype.slice.call(arguments, 2),
            msg = messageFormat.replace(
                /%(\d)/g,
                function (whole, index) {
                    return args[index] || '';
                }
            );

        if (typeof token.lineNumber === 'number') {
            error = new Error('Line ' + token.lineNumber + ': ' + msg);
            error.index = token.range[0];
            error.lineNumber = token.lineNumber;
            error.column = token.range[0] - lineStart + 1;
        } else {
            error = new Error('Line ' + lineNumber + ': ' + msg);
            error.index = index;
            error.lineNumber = lineNumber;
            error.column = index - lineStart + 1;
        }

        throw error;
    }

    function throwErrorTolerant() {
        try {
            throwError.apply(null, arguments);
        } catch (e) {
            if (extra.errors) {
                extra.errors.push(e);
            } else {
                throw e;
            }
        }
    }


    // Throw an exception because of the token.

    function throwUnexpected(token) {
        if (token.type === Token.EOF) {
            throwError(token, Messages.UnexpectedEOS);
        }

        if (token.type === Token.NumericLiteral) {
            throwError(token, Messages.UnexpectedNumber);
        }

        if (token.type === Token.StringLiteral) {
            throwError(token, Messages.UnexpectedString);
        }

        if (token.type === Token.Identifier) {
            throwError(token, Messages.UnexpectedIdentifier);
        }

        if (token.type === Token.Keyword) {
            if (isFutureReservedWord(token.value)) {
                throwError(token, Messages.UnexpectedReserved);
            } else if (strict && isStrictModeReservedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictReservedWord);
                return;
            }
            throwError(token, Messages.UnexpectedToken, token.value);
        }

        // BooleanLiteral, NullLiteral, or Punctuator.
        throwError(token, Messages.UnexpectedToken, token.value);
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token);
        }
    }

    // Expect the next token to match the specified keyword.
    // If not, an exception will be thrown.

    function expectKeyword(keyword) {
        var token = lex();
        if (token.type !== Token.Keyword || token.value !== keyword) {
            throwUnexpected(token);
        }
    }

    // Return true if the next token matches the specified punctuator.

    function match(value) {
        var token = lookahead();
        return token.type === Token.Punctuator && token.value === value;
    }

    // Return true if the next token matches the specified keyword

    function matchKeyword(keyword) {
        var token = lookahead();
        return token.type === Token.Keyword && token.value === keyword;
    }

    // Return true if the next token is an assignment operator

    function matchAssign() {
        var token = lookahead(),
            op = token.value;

        if (token.type !== Token.Punctuator) {
            return false;
        }
        return op === '=' ||
            op === '*=' ||
            op === '/=' ||
            op === '%=' ||
            op === '+=' ||
            op === '-=' ||
            op === '<<=' ||
            op === '>>=' ||
            op === '>>>=' ||
            op === '&=' ||
            op === '^=' ||
            op === '|=';
    }

    function consumeSemicolon() {
        var token, line;

        // Catch the very common case first.
        if (source[index] === ';') {
            lex();
            return;
        }

        line = lineNumber;
        skipComment();
        if (lineNumber !== line) {
            return;
        }

        if (match(';')) {
            lex();
            return;
        }

        token = lookahead();
        if (token.type !== Token.EOF && !match('}')) {
            throwUnexpected(token);
        }
    }

    // Return true if provided expression is LeftHandSideExpression

    function isLeftHandSide(expr) {
        return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
    }

    // 11.1.4 Array Initialiser

    function parseArrayInitialiser() {
        var elements = [];

        expect('[');

        while (!match(']')) {
            if (match(',')) {
                lex();
                elements.push(null);
            } else {
                elements.push(parseAssignmentExpression());

                if (!match(']')) {
                    expect(',');
                }
            }
        }

        expect(']');

        return {
            type: Syntax.ArrayExpression,
            elements: elements
        };
    }

    // 11.1.5 Object Initialiser

    function parsePropertyFunction(param, first) {
        var previousStrict, body;

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (first && strict && isRestrictedWord(param[0].name)) {
            throwErrorTolerant(first, Messages.StrictParamName);
        }
        strict = previousStrict;

        return {
            type: Syntax.FunctionExpression,
            id: null,
            params: param,
            defaults: [],
            body: body,
            rest: null,
            generator: false,
            expression: false
        };
    }

    function parseObjectPropertyKey() {
        var token = lex();

        // Note: This function is called only from parseObjectProperty(), where
        // EOF and Punctuator tokens are already filtered out.

        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return createLiteral(token);
        }

        return {
            type: Syntax.Identifier,
            name: token.value
        };
    }

    function parseObjectProperty() {
        var token, key, id, param;

        token = lookahead();

        if (token.type === Token.Identifier) {

            id = parseObjectPropertyKey();

            // Property Assignment: Getter and Setter.

            if (token.value === 'get' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                expect(')');
                return {
                    type: Syntax.Property,
                    key: key,
                    value: parsePropertyFunction([]),
                    kind: 'get'
                };
            } else if (token.value === 'set' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                token = lookahead();
                if (token.type !== Token.Identifier) {
                    expect(')');
                    throwErrorTolerant(token, Messages.UnexpectedToken, token.value);
                    return {
                        type: Syntax.Property,
                        key: key,
                        value: parsePropertyFunction([]),
                        kind: 'set'
                    };
                } else {
                    param = [ parseVariableIdentifier() ];
                    expect(')');
                    return {
                        type: Syntax.Property,
                        key: key,
                        value: parsePropertyFunction(param, token),
                        kind: 'set'
                    };
                }
            } else {
                expect(':');
                return {
                    type: Syntax.Property,
                    key: id,
                    value: parseAssignmentExpression(),
                    kind: 'init'
                };
            }
        } else if (token.type === Token.EOF || token.type === Token.Punctuator) {
            throwUnexpected(token);
        } else {
            key = parseObjectPropertyKey();
            expect(':');
            return {
                type: Syntax.Property,
                key: key,
                value: parseAssignmentExpression(),
                kind: 'init'
            };
        }
    }

    function parseObjectInitialiser() {
        var properties = [], property, name, kind, map = {}, toString = String;

        expect('{');

        while (!match('}')) {
            property = parseObjectProperty();

            if (property.key.type === Syntax.Identifier) {
                name = property.key.name;
            } else {
                name = toString(property.key.value);
            }
            kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;
            if (Object.prototype.hasOwnProperty.call(map, name)) {
                if (map[name] === PropertyKind.Data) {
                    if (strict && kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.StrictDuplicateProperty);
                    } else if (kind !== PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    }
                } else {
                    if (kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    } else if (map[name] & kind) {
                        throwErrorTolerant({}, Messages.AccessorGetSet);
                    }
                }
                map[name] |= kind;
            } else {
                map[name] = kind;
            }

            properties.push(property);

            if (!match('}')) {
                expect(',');
            }
        }

        expect('}');

        return {
            type: Syntax.ObjectExpression,
            properties: properties
        };
    }

    // 11.1.6 The Grouping Operator

    function parseGroupExpression() {
        var expr;

        expect('(');

        expr = parseExpression();

        expect(')');

        return expr;
    }


    // 11.1 Primary Expressions

    function parsePrimaryExpression() {
        var token = lookahead(),
            type = token.type;

        if (type === Token.Identifier) {
            return {
                type: Syntax.Identifier,
                name: lex().value
            };
        }

        if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return createLiteral(lex());
        }

        if (type === Token.Keyword) {
            if (matchKeyword('this')) {
                lex();
                return {
                    type: Syntax.ThisExpression
                };
            }

            if (matchKeyword('function')) {
                return parseFunctionExpression();
            }
        }

        if (type === Token.BooleanLiteral) {
            lex();
            token.value = (token.value === 'true');
            return createLiteral(token);
        }

        if (type === Token.NullLiteral) {
            lex();
            token.value = null;
            return createLiteral(token);
        }

        if (match('[')) {
            return parseArrayInitialiser();
        }

        if (match('{')) {
            return parseObjectInitialiser();
        }

        if (match('(')) {
            return parseGroupExpression();
        }

        if (match('/') || match('/=')) {
            return createLiteral(scanRegExp());
        }

        return throwUnexpected(lex());
    }

    // 11.2 Left-Hand-Side Expressions

    function parseArguments() {
        var args = [];

        expect('(');

        if (!match(')')) {
            while (index < length) {
                args.push(parseAssignmentExpression());
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return args;
    }

    function parseNonComputedProperty() {
        var token = lex();

        if (!isIdentifierName(token)) {
            throwUnexpected(token);
        }

        return {
            type: Syntax.Identifier,
            name: token.value
        };
    }

    function parseNonComputedMember() {
        expect('.');

        return parseNonComputedProperty();
    }

    function parseComputedMember() {
        var expr;

        expect('[');

        expr = parseExpression();

        expect(']');

        return expr;
    }

    function parseNewExpression() {
        var expr;

        expectKeyword('new');

        expr = {
            type: Syntax.NewExpression,
            callee: parseLeftHandSideExpression(),
            'arguments': []
        };

        if (match('(')) {
            expr['arguments'] = parseArguments();
        }

        return expr;
    }

    function parseLeftHandSideExpressionAllowCall() {
        var expr;

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[') || match('(')) {
            if (match('(')) {
                expr = {
                    type: Syntax.CallExpression,
                    callee: expr,
                    'arguments': parseArguments()
                };
            } else if (match('[')) {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: true,
                    object: expr,
                    property: parseComputedMember()
                };
            } else {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: false,
                    object: expr,
                    property: parseNonComputedMember()
                };
            }
        }

        return expr;
    }


    function parseLeftHandSideExpression() {
        var expr;

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[')) {
            if (match('[')) {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: true,
                    object: expr,
                    property: parseComputedMember()
                };
            } else {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: false,
                    object: expr,
                    property: parseNonComputedMember()
                };
            }
        }

        return expr;
    }

    // 11.3 Postfix Expressions

    function parsePostfixExpression() {
        var expr = parseLeftHandSideExpressionAllowCall(), token;

        token = lookahead();
        if (token.type !== Token.Punctuator) {
            return expr;
        }

        if ((match('++') || match('--')) && !peekLineTerminator()) {
            // 11.3.1, 11.3.2
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPostfix);
            }

            if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            expr = {
                type: Syntax.UpdateExpression,
                operator: lex().value,
                argument: expr,
                prefix: false
            };
        }

        return expr;
    }

    // 11.4 Unary Operators

    function parseUnaryExpression() {
        var token, expr;

        token = lookahead();
        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return parsePostfixExpression();
        }

        if (match('++') || match('--')) {
            token = lex();
            expr = parseUnaryExpression();
            // 11.4.4, 11.4.5
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPrefix);
            }

            if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            expr = {
                type: Syntax.UpdateExpression,
                operator: token.value,
                argument: expr,
                prefix: true
            };
            return expr;
        }

        if (match('+') || match('-') || match('~') || match('!')) {
            expr = {
                type: Syntax.UnaryExpression,
                operator: lex().value,
                argument: parseUnaryExpression(),
                prefix: true
            };
            return expr;
        }

        if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            expr = {
                type: Syntax.UnaryExpression,
                operator: lex().value,
                argument: parseUnaryExpression(),
                prefix: true
            };
            if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                throwErrorTolerant({}, Messages.StrictDelete);
            }
            return expr;
        }

        return parsePostfixExpression();
    }

    // 11.5 Multiplicative Operators

    function parseMultiplicativeExpression() {
        var expr = parseUnaryExpression();

        while (match('*') || match('/') || match('%')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseUnaryExpression()
            };
        }

        return expr;
    }

    // 11.6 Additive Operators

    function parseAdditiveExpression() {
        var expr = parseMultiplicativeExpression();

        while (match('+') || match('-')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseMultiplicativeExpression()
            };
        }

        return expr;
    }

    // 11.7 Bitwise Shift Operators

    function parseShiftExpression() {
        var expr = parseAdditiveExpression();

        while (match('<<') || match('>>') || match('>>>')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseAdditiveExpression()
            };
        }

        return expr;
    }
    // 11.8 Relational Operators

    function parseRelationalExpression() {
        var expr, previousAllowIn;

        previousAllowIn = state.allowIn;
        state.allowIn = true;

        expr = parseShiftExpression();

        while (match('<') || match('>') || match('<=') || match('>=') || (previousAllowIn && matchKeyword('in')) || matchKeyword('instanceof')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseShiftExpression()
            };
        }

        state.allowIn = previousAllowIn;
        return expr;
    }

    // 11.9 Equality Operators

    function parseEqualityExpression() {
        var expr = parseRelationalExpression();

        while (match('==') || match('!=') || match('===') || match('!==')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseRelationalExpression()
            };
        }

        return expr;
    }

    // 11.10 Binary Bitwise Operators

    function parseBitwiseANDExpression() {
        var expr = parseEqualityExpression();

        while (match('&')) {
            lex();
            expr = {
                type: Syntax.BinaryExpression,
                operator: '&',
                left: expr,
                right: parseEqualityExpression()
            };
        }

        return expr;
    }

    function parseBitwiseXORExpression() {
        var expr = parseBitwiseANDExpression();

        while (match('^')) {
            lex();
            expr = {
                type: Syntax.BinaryExpression,
                operator: '^',
                left: expr,
                right: parseBitwiseANDExpression()
            };
        }

        return expr;
    }

    function parseBitwiseORExpression() {
        var expr = parseBitwiseXORExpression();

        while (match('|')) {
            lex();
            expr = {
                type: Syntax.BinaryExpression,
                operator: '|',
                left: expr,
                right: parseBitwiseXORExpression()
            };
        }

        return expr;
    }

    // 11.11 Binary Logical Operators

    function parseLogicalANDExpression() {
        var expr = parseBitwiseORExpression();

        while (match('&&')) {
            lex();
            expr = {
                type: Syntax.LogicalExpression,
                operator: '&&',
                left: expr,
                right: parseBitwiseORExpression()
            };
        }

        return expr;
    }

    function parseLogicalORExpression() {
        var expr = parseLogicalANDExpression();

        while (match('||')) {
            lex();
            expr = {
                type: Syntax.LogicalExpression,
                operator: '||',
                left: expr,
                right: parseLogicalANDExpression()
            };
        }

        return expr;
    }

    // 11.12 Conditional Operator

    function parseConditionalExpression() {
        var expr, previousAllowIn, consequent;

        expr = parseLogicalORExpression();

        if (match('?')) {
            lex();
            previousAllowIn = state.allowIn;
            state.allowIn = true;
            consequent = parseAssignmentExpression();
            state.allowIn = previousAllowIn;
            expect(':');

            expr = {
                type: Syntax.ConditionalExpression,
                test: expr,
                consequent: consequent,
                alternate: parseAssignmentExpression()
            };
        }

        return expr;
    }

    // 11.13 Assignment Operators

    function parseAssignmentExpression() {
        var token, expr;

        token = lookahead();
        expr = parseConditionalExpression();

        if (matchAssign()) {
            // LeftHandSideExpression
            if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            // 11.13.1
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant(token, Messages.StrictLHSAssignment);
            }

            expr = {
                type: Syntax.AssignmentExpression,
                operator: lex().value,
                left: expr,
                right: parseAssignmentExpression()
            };
        }

        return expr;
    }

    // 11.14 Comma Operator

    function parseExpression() {
        var expr = parseAssignmentExpression();

        if (match(',')) {
            expr = {
                type: Syntax.SequenceExpression,
                expressions: [ expr ]
            };

            while (index < length) {
                if (!match(',')) {
                    break;
                }
                lex();
                expr.expressions.push(parseAssignmentExpression());
            }

        }
        return expr;
    }

    // 12.1 Block

    function parseStatementList() {
        var list = [],
            statement;

        while (index < length) {
            if (match('}')) {
                break;
            }
            statement = parseSourceElement();
            if (typeof statement === 'undefined') {
                break;
            }
            list.push(statement);
        }

        return list;
    }

    function parseBlock() {
        var block;

        expect('{');

        block = parseStatementList();

        expect('}');

        return {
            type: Syntax.BlockStatement,
            body: block
        };
    }

    // 12.2 Variable Statement

    function parseVariableIdentifier() {
        var token = lex();

        if (token.type !== Token.Identifier) {
            throwUnexpected(token);
        }

        return {
            type: Syntax.Identifier,
            name: token.value
        };
    }

    function parseVariableDeclaration(kind) {
        var id = parseVariableIdentifier(),
            init = null;

        // 12.2.1
        if (strict && isRestrictedWord(id.name)) {
            throwErrorTolerant({}, Messages.StrictVarName);
        }

        if (kind === 'const') {
            expect('=');
            init = parseAssignmentExpression();
        } else if (match('=')) {
            lex();
            init = parseAssignmentExpression();
        }

        return {
            type: Syntax.VariableDeclarator,
            id: id,
            init: init
        };
    }

    function parseVariableDeclarationList(kind) {
        var list = [];

        do {
            list.push(parseVariableDeclaration(kind));
            if (!match(',')) {
                break;
            }
            lex();
        } while (index < length);

        return list;
    }

    function parseVariableStatement() {
        var declarations;

        expectKeyword('var');

        declarations = parseVariableDeclarationList();

        consumeSemicolon();

        return {
            type: Syntax.VariableDeclaration,
            declarations: declarations,
            kind: 'var'
        };
    }

    // kind may be `const` or `let`
    // Both are experimental and not in the specification yet.
    // see http://wiki.ecmascript.org/doku.php?id=harmony:const
    // and http://wiki.ecmascript.org/doku.php?id=harmony:let
    function parseConstLetDeclaration(kind) {
        var declarations;

        expectKeyword(kind);

        declarations = parseVariableDeclarationList(kind);

        consumeSemicolon();

        return {
            type: Syntax.VariableDeclaration,
            declarations: declarations,
            kind: kind
        };
    }

    // 12.3 Empty Statement

    function parseEmptyStatement() {
        expect(';');

        return {
            type: Syntax.EmptyStatement
        };
    }

    // 12.4 Expression Statement

    function parseExpressionStatement() {
        var expr = parseExpression();

        consumeSemicolon();

        return {
            type: Syntax.ExpressionStatement,
            expression: expr
        };
    }

    // 12.5 If statement

    function parseIfStatement() {
        var test, consequent, alternate;

        expectKeyword('if');

        expect('(');

        test = parseExpression();

        expect(')');

        consequent = parseStatement();

        if (matchKeyword('else')) {
            lex();
            alternate = parseStatement();
        } else {
            alternate = null;
        }

        return {
            type: Syntax.IfStatement,
            test: test,
            consequent: consequent,
            alternate: alternate
        };
    }

    // 12.6 Iteration Statements

    function parseDoWhileStatement() {
        var body, test, oldInIteration;

        expectKeyword('do');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        if (match(';')) {
            lex();
        }

        return {
            type: Syntax.DoWhileStatement,
            body: body,
            test: test
        };
    }

    function parseWhileStatement() {
        var test, body, oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return {
            type: Syntax.WhileStatement,
            test: test,
            body: body
        };
    }

    function parseForVariableDeclaration() {
        var token = lex();

        return {
            type: Syntax.VariableDeclaration,
            declarations: parseVariableDeclarationList(),
            kind: token.value
        };
    }

    function parseForStatement() {
        var init, test, update, left, right, body, oldInIteration;

        init = test = update = null;

        expectKeyword('for');

        expect('(');

        if (match(';')) {
            lex();
        } else {
            if (matchKeyword('var') || matchKeyword('let')) {
                state.allowIn = false;
                init = parseForVariableDeclaration();
                state.allowIn = true;

                if (init.declarations.length === 1 && matchKeyword('in')) {
                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            } else {
                state.allowIn = false;
                init = parseExpression();
                state.allowIn = true;

                if (matchKeyword('in')) {
                    // LeftHandSideExpression
                    if (!isLeftHandSide(init)) {
                        throwError({}, Messages.InvalidLHSInForIn);
                    }

                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            }

            if (typeof left === 'undefined') {
                expect(';');
            }
        }

        if (typeof left === 'undefined') {

            if (!match(';')) {
                test = parseExpression();
            }
            expect(';');

            if (!match(')')) {
                update = parseExpression();
            }
        }

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        if (typeof left === 'undefined') {
            return {
                type: Syntax.ForStatement,
                init: init,
                test: test,
                update: update,
                body: body
            };
        }

        return {
            type: Syntax.ForInStatement,
            left: left,
            right: right,
            body: body,
            each: false
        };
    }

    // 12.7 The continue statement

    function parseContinueStatement() {
        var token, label = null;

        expectKeyword('continue');

        // Optimize the most common form: 'continue;'.
        if (source[index] === ';') {
            lex();

            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return {
                type: Syntax.ContinueStatement,
                label: null
            };
        }

        if (peekLineTerminator()) {
            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return {
                type: Syntax.ContinueStatement,
                label: null
            };
        }

        token = lookahead();
        if (token.type === Token.Identifier) {
            label = parseVariableIdentifier();

            if (!Object.prototype.hasOwnProperty.call(state.labelSet, label.name)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !state.inIteration) {
            throwError({}, Messages.IllegalContinue);
        }

        return {
            type: Syntax.ContinueStatement,
            label: label
        };
    }

    // 12.8 The break statement

    function parseBreakStatement() {
        var token, label = null;

        expectKeyword('break');

        // Optimize the most common form: 'break;'.
        if (source[index] === ';') {
            lex();

            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return {
                type: Syntax.BreakStatement,
                label: null
            };
        }

        if (peekLineTerminator()) {
            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return {
                type: Syntax.BreakStatement,
                label: null
            };
        }

        token = lookahead();
        if (token.type === Token.Identifier) {
            label = parseVariableIdentifier();

            if (!Object.prototype.hasOwnProperty.call(state.labelSet, label.name)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !(state.inIteration || state.inSwitch)) {
            throwError({}, Messages.IllegalBreak);
        }

        return {
            type: Syntax.BreakStatement,
            label: label
        };
    }

    // 12.9 The return statement

    function parseReturnStatement() {
        var token, argument = null;

        expectKeyword('return');

        if (!state.inFunctionBody) {
            throwErrorTolerant({}, Messages.IllegalReturn);
        }

        // 'return' followed by a space and an identifier is very common.
        if (source[index] === ' ') {
            if (isIdentifierStart(source[index + 1])) {
                argument = parseExpression();
                consumeSemicolon();
                return {
                    type: Syntax.ReturnStatement,
                    argument: argument
                };
            }
        }

        if (peekLineTerminator()) {
            return {
                type: Syntax.ReturnStatement,
                argument: null
            };
        }

        if (!match(';')) {
            token = lookahead();
            if (!match('}') && token.type !== Token.EOF) {
                argument = parseExpression();
            }
        }

        consumeSemicolon();

        return {
            type: Syntax.ReturnStatement,
            argument: argument
        };
    }

    // 12.10 The with statement

    function parseWithStatement() {
        var object, body;

        if (strict) {
            throwErrorTolerant({}, Messages.StrictModeWith);
        }

        expectKeyword('with');

        expect('(');

        object = parseExpression();

        expect(')');

        body = parseStatement();

        return {
            type: Syntax.WithStatement,
            object: object,
            body: body
        };
    }

    // 12.10 The swith statement

    function parseSwitchCase() {
        var test,
            consequent = [],
            statement;

        if (matchKeyword('default')) {
            lex();
            test = null;
        } else {
            expectKeyword('case');
            test = parseExpression();
        }
        expect(':');

        while (index < length) {
            if (match('}') || matchKeyword('default') || matchKeyword('case')) {
                break;
            }
            statement = parseStatement();
            if (typeof statement === 'undefined') {
                break;
            }
            consequent.push(statement);
        }

        return {
            type: Syntax.SwitchCase,
            test: test,
            consequent: consequent
        };
    }

    function parseSwitchStatement() {
        var discriminant, cases, clause, oldInSwitch, defaultFound;

        expectKeyword('switch');

        expect('(');

        discriminant = parseExpression();

        expect(')');

        expect('{');

        if (match('}')) {
            lex();
            return {
                type: Syntax.SwitchStatement,
                discriminant: discriminant
            };
        }

        cases = [];

        oldInSwitch = state.inSwitch;
        state.inSwitch = true;
        defaultFound = false;

        while (index < length) {
            if (match('}')) {
                break;
            }
            clause = parseSwitchCase();
            if (clause.test === null) {
                if (defaultFound) {
                    throwError({}, Messages.MultipleDefaultsInSwitch);
                }
                defaultFound = true;
            }
            cases.push(clause);
        }

        state.inSwitch = oldInSwitch;

        expect('}');

        return {
            type: Syntax.SwitchStatement,
            discriminant: discriminant,
            cases: cases
        };
    }

    // 12.13 The throw statement

    function parseThrowStatement() {
        var argument;

        expectKeyword('throw');

        if (peekLineTerminator()) {
            throwError({}, Messages.NewlineAfterThrow);
        }

        argument = parseExpression();

        consumeSemicolon();

        return {
            type: Syntax.ThrowStatement,
            argument: argument
        };
    }

    // 12.14 The try statement

    function parseCatchClause() {
        var param;

        expectKeyword('catch');

        expect('(');
        if (match(')')) {
            throwUnexpected(lookahead());
        }

        param = parseVariableIdentifier();
        // 12.14.1
        if (strict && isRestrictedWord(param.name)) {
            throwErrorTolerant({}, Messages.StrictCatchVariable);
        }

        expect(')');

        return {
            type: Syntax.CatchClause,
            param: param,
            body: parseBlock()
        };
    }

    function parseTryStatement() {
        var block, handlers = [], finalizer = null;

        expectKeyword('try');

        block = parseBlock();

        if (matchKeyword('catch')) {
            handlers.push(parseCatchClause());
        }

        if (matchKeyword('finally')) {
            lex();
            finalizer = parseBlock();
        }

        if (handlers.length === 0 && !finalizer) {
            throwError({}, Messages.NoCatchOrFinally);
        }

        return {
            type: Syntax.TryStatement,
            block: block,
            guardedHandlers: [],
            handlers: handlers,
            finalizer: finalizer
        };
    }

    // 12.15 The debugger statement

    function parseDebuggerStatement() {
        expectKeyword('debugger');

        consumeSemicolon();

        return {
            type: Syntax.DebuggerStatement
        };
    }

    // 12 Statements

    function parseStatement() {
        var token = lookahead(),
            expr,
            labeledBody;

        if (token.type === Token.EOF) {
            throwUnexpected(token);
        }

        if (token.type === Token.Punctuator) {
            switch (token.value) {
            case ';':
                return parseEmptyStatement();
            case '{':
                return parseBlock();
            case '(':
                return parseExpressionStatement();
            default:
                break;
            }
        }

        if (token.type === Token.Keyword) {
            switch (token.value) {
            case 'break':
                return parseBreakStatement();
            case 'continue':
                return parseContinueStatement();
            case 'debugger':
                return parseDebuggerStatement();
            case 'do':
                return parseDoWhileStatement();
            case 'for':
                return parseForStatement();
            case 'function':
                return parseFunctionDeclaration();
            case 'if':
                return parseIfStatement();
            case 'return':
                return parseReturnStatement();
            case 'switch':
                return parseSwitchStatement();
            case 'throw':
                return parseThrowStatement();
            case 'try':
                return parseTryStatement();
            case 'var':
                return parseVariableStatement();
            case 'while':
                return parseWhileStatement();
            case 'with':
                return parseWithStatement();
            default:
                break;
            }
        }

        expr = parseExpression();

        // 12.12 Labelled Statements
        if ((expr.type === Syntax.Identifier) && match(':')) {
            lex();

            if (Object.prototype.hasOwnProperty.call(state.labelSet, expr.name)) {
                throwError({}, Messages.Redeclaration, 'Label', expr.name);
            }

            state.labelSet[expr.name] = true;
            labeledBody = parseStatement();
            delete state.labelSet[expr.name];

            return {
                type: Syntax.LabeledStatement,
                label: expr,
                body: labeledBody
            };
        }

        consumeSemicolon();

        return {
            type: Syntax.ExpressionStatement,
            expression: expr
        };
    }

    // 13 Function Definition

    function parseFunctionSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted,
            oldLabelSet, oldInIteration, oldInSwitch, oldInFunctionBody;

        expect('{');

        while (index < length) {
            token = lookahead();
            if (token.type !== Token.StringLiteral) {
                break;
            }

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = sliceSource(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        oldLabelSet = state.labelSet;
        oldInIteration = state.inIteration;
        oldInSwitch = state.inSwitch;
        oldInFunctionBody = state.inFunctionBody;

        state.labelSet = {};
        state.inIteration = false;
        state.inSwitch = false;
        state.inFunctionBody = true;

        while (index < length) {
            if (match('}')) {
                break;
            }
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }

        expect('}');

        state.labelSet = oldLabelSet;
        state.inIteration = oldInIteration;
        state.inSwitch = oldInSwitch;
        state.inFunctionBody = oldInFunctionBody;

        return {
            type: Syntax.BlockStatement,
            body: sourceElements
        };
    }

    function parseFunctionDeclaration() {
        var id, param, params = [], body, token, stricted, firstRestricted, message, previousStrict, paramSet;

        expectKeyword('function');
        token = lookahead();
        id = parseVariableIdentifier();
        if (strict) {
            if (isRestrictedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictFunctionName);
            }
        } else {
            if (isRestrictedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictFunctionName;
            } else if (isStrictModeReservedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictReservedWord;
            }
        }

        expect('(');

        if (!match(')')) {
            paramSet = {};
            while (index < length) {
                token = lookahead();
                param = parseVariableIdentifier();
                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        stricted = token;
                        message = Messages.StrictParamName;
                    }
                    if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                        stricted = token;
                        message = Messages.StrictParamDupe;
                    }
                } else if (!firstRestricted) {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    } else if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamDupe;
                    }
                }
                params.push(param);
                paramSet[param.name] = true;
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return {
            type: Syntax.FunctionDeclaration,
            id: id,
            params: params,
            defaults: [],
            body: body,
            rest: null,
            generator: false,
            expression: false
        };
    }

    function parseFunctionExpression() {
        var token, id = null, stricted, firstRestricted, message, param, params = [], body, previousStrict, paramSet;

        expectKeyword('function');

        if (!match('(')) {
            token = lookahead();
            id = parseVariableIdentifier();
            if (strict) {
                if (isRestrictedWord(token.value)) {
                    throwErrorTolerant(token, Messages.StrictFunctionName);
                }
            } else {
                if (isRestrictedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                } else if (isStrictModeReservedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }
        }

        expect('(');

        if (!match(')')) {
            paramSet = {};
            while (index < length) {
                token = lookahead();
                param = parseVariableIdentifier();
                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        stricted = token;
                        message = Messages.StrictParamName;
                    }
                    if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                        stricted = token;
                        message = Messages.StrictParamDupe;
                    }
                } else if (!firstRestricted) {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    } else if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamDupe;
                    }
                }
                params.push(param);
                paramSet[param.name] = true;
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return {
            type: Syntax.FunctionExpression,
            id: id,
            params: params,
            defaults: [],
            body: body,
            rest: null,
            generator: false,
            expression: false
        };
    }

    // 14 Program

    function parseSourceElement() {
        var token = lookahead();

        if (token.type === Token.Keyword) {
            switch (token.value) {
            case 'const':
            case 'let':
                return parseConstLetDeclaration(token.value);
            case 'function':
                return parseFunctionDeclaration();
            default:
                return parseStatement();
            }
        }

        if (token.type !== Token.EOF) {
            return parseStatement();
        }
    }

    function parseSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted;

        while (index < length) {
            token = lookahead();
            if (token.type !== Token.StringLiteral) {
                break;
            }

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = sliceSource(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        while (index < length) {
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }
        return sourceElements;
    }

    function parseProgram() {
        var program;
        strict = false;
        program = {
            type: Syntax.Program,
            body: parseSourceElements()
        };
        return program;
    }

    // The following functions are needed only when the option to preserve
    // the comments is active.

    function addComment(type, value, start, end, loc) {
        assert(typeof start === 'number', 'Comment must have valid position');

        // Because the way the actual token is scanned, often the comments
        // (if any) are skipped twice during the lexical analysis.
        // Thus, we need to skip adding a comment if the comment array already
        // handled it.
        if (extra.comments.length > 0) {
            if (extra.comments[extra.comments.length - 1].range[1] > start) {
                return;
            }
        }

        extra.comments.push({
            type: type,
            value: value,
            range: [start, end],
            loc: loc
        });
    }

    function scanComment() {
        var comment, ch, loc, start, blockComment, lineComment;

        comment = '';
        blockComment = false;
        lineComment = false;

        while (index < length) {
            ch = source[index];

            if (lineComment) {
                ch = source[index++];
                if (isLineTerminator(ch)) {
                    loc.end = {
                        line: lineNumber,
                        column: index - lineStart - 1
                    };
                    lineComment = false;
                    addComment('Line', comment, start, index - 1, loc);
                    if (ch === '\r' && source[index] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                    comment = '';
                } else if (index >= length) {
                    lineComment = false;
                    comment += ch;
                    loc.end = {
                        line: lineNumber,
                        column: length - lineStart
                    };
                    addComment('Line', comment, start, length, loc);
                } else {
                    comment += ch;
                }
            } else if (blockComment) {
                if (isLineTerminator(ch)) {
                    if (ch === '\r' && source[index + 1] === '\n') {
                        ++index;
                        comment += '\r\n';
                    } else {
                        comment += ch;
                    }
                    ++lineNumber;
                    ++index;
                    lineStart = index;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    ch = source[index++];
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                    comment += ch;
                    if (ch === '*') {
                        ch = source[index];
                        if (ch === '/') {
                            comment = comment.substr(0, comment.length - 1);
                            blockComment = false;
                            ++index;
                            loc.end = {
                                line: lineNumber,
                                column: index - lineStart
                            };
                            addComment('Block', comment, start, index, loc);
                            comment = '';
                        }
                    }
                }
            } else if (ch === '/') {
                ch = source[index + 1];
                if (ch === '/') {
                    loc = {
                        start: {
                            line: lineNumber,
                            column: index - lineStart
                        }
                    };
                    start = index;
                    index += 2;
                    lineComment = true;
                    if (index >= length) {
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart
                        };
                        lineComment = false;
                        addComment('Line', comment, start, index, loc);
                    }
                } else if (ch === '*') {
                    start = index;
                    index += 2;
                    blockComment = true;
                    loc = {
                        start: {
                            line: lineNumber,
                            column: index - lineStart - 2
                        }
                    };
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    break;
                }
            } else if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch ===  '\r' && source[index] === '\n') {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
            } else {
                break;
            }
        }
    }

    function filterCommentLocation() {
        var i, entry, comment, comments = [];

        for (i = 0; i < extra.comments.length; ++i) {
            entry = extra.comments[i];
            comment = {
                type: entry.type,
                value: entry.value
            };
            if (extra.range) {
                comment.range = entry.range;
            }
            if (extra.loc) {
                comment.loc = entry.loc;
            }
            comments.push(comment);
        }

        extra.comments = comments;
    }

    function collectToken() {
        var start, loc, token, range, value;

        skipComment();
        start = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        token = extra.advance();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (token.type !== Token.EOF) {
            range = [token.range[0], token.range[1]];
            value = sliceSource(token.range[0], token.range[1]);
            extra.tokens.push({
                type: TokenName[token.type],
                value: value,
                range: range,
                loc: loc
            });
        }

        return token;
    }

    function collectRegex() {
        var pos, loc, regex, token;

        skipComment();

        pos = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        regex = extra.scanRegExp();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        // Pop the previous token, which is likely '/' or '/='
        if (extra.tokens.length > 0) {
            token = extra.tokens[extra.tokens.length - 1];
            if (token.range[0] === pos && token.type === 'Punctuator') {
                if (token.value === '/' || token.value === '/=') {
                    extra.tokens.pop();
                }
            }
        }

        extra.tokens.push({
            type: 'RegularExpression',
            value: regex.literal,
            range: [pos, index],
            loc: loc
        });

        return regex;
    }

    function filterTokenLocation() {
        var i, entry, token, tokens = [];

        for (i = 0; i < extra.tokens.length; ++i) {
            entry = extra.tokens[i];
            token = {
                type: entry.type,
                value: entry.value
            };
            if (extra.range) {
                token.range = entry.range;
            }
            if (extra.loc) {
                token.loc = entry.loc;
            }
            tokens.push(token);
        }

        extra.tokens = tokens;
    }

    function createLiteral(token) {
        return {
            type: Syntax.Literal,
            value: token.value
        };
    }

    function createRawLiteral(token) {
        return {
            type: Syntax.Literal,
            value: token.value,
            raw: sliceSource(token.range[0], token.range[1])
        };
    }

    function createLocationMarker() {
        var marker = {};

        marker.range = [index, index];
        marker.loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            },
            end: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        marker.end = function () {
            this.range[1] = index;
            this.loc.end.line = lineNumber;
            this.loc.end.column = index - lineStart;
        };

        marker.applyGroup = function (node) {
            if (extra.range) {
                node.groupRange = [this.range[0], this.range[1]];
            }
            if (extra.loc) {
                node.groupLoc = {
                    start: {
                        line: this.loc.start.line,
                        column: this.loc.start.column
                    },
                    end: {
                        line: this.loc.end.line,
                        column: this.loc.end.column
                    }
                };
            }
        };

        marker.apply = function (node) {
            if (extra.range) {
                node.range = [this.range[0], this.range[1]];
            }
            if (extra.loc) {
                node.loc = {
                    start: {
                        line: this.loc.start.line,
                        column: this.loc.start.column
                    },
                    end: {
                        line: this.loc.end.line,
                        column: this.loc.end.column
                    }
                };
            }
        };

        return marker;
    }

    function trackGroupExpression() {
        var marker, expr;

        skipComment();
        marker = createLocationMarker();
        expect('(');

        expr = parseExpression();

        expect(')');

        marker.end();
        marker.applyGroup(expr);

        return expr;
    }

    function trackLeftHandSideExpression() {
        var marker, expr;

        skipComment();
        marker = createLocationMarker();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[')) {
            if (match('[')) {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: true,
                    object: expr,
                    property: parseComputedMember()
                };
                marker.end();
                marker.apply(expr);
            } else {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: false,
                    object: expr,
                    property: parseNonComputedMember()
                };
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }

    function trackLeftHandSideExpressionAllowCall() {
        var marker, expr;

        skipComment();
        marker = createLocationMarker();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[') || match('(')) {
            if (match('(')) {
                expr = {
                    type: Syntax.CallExpression,
                    callee: expr,
                    'arguments': parseArguments()
                };
                marker.end();
                marker.apply(expr);
            } else if (match('[')) {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: true,
                    object: expr,
                    property: parseComputedMember()
                };
                marker.end();
                marker.apply(expr);
            } else {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: false,
                    object: expr,
                    property: parseNonComputedMember()
                };
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }

    function filterGroup(node) {
        var n, i, entry;

        n = (Object.prototype.toString.apply(node) === '[object Array]') ? [] : {};
        for (i in node) {
            if (node.hasOwnProperty(i) && i !== 'groupRange' && i !== 'groupLoc') {
                entry = node[i];
                if (entry === null || typeof entry !== 'object' || entry instanceof RegExp) {
                    n[i] = entry;
                } else {
                    n[i] = filterGroup(entry);
                }
            }
        }
        return n;
    }

    function wrapTrackingFunction(range, loc) {

        return function (parseFunction) {

            function isBinary(node) {
                return node.type === Syntax.LogicalExpression ||
                    node.type === Syntax.BinaryExpression;
            }

            function visit(node) {
                var start, end;

                if (isBinary(node.left)) {
                    visit(node.left);
                }
                if (isBinary(node.right)) {
                    visit(node.right);
                }

                if (range) {
                    if (node.left.groupRange || node.right.groupRange) {
                        start = node.left.groupRange ? node.left.groupRange[0] : node.left.range[0];
                        end = node.right.groupRange ? node.right.groupRange[1] : node.right.range[1];
                        node.range = [start, end];
                    } else if (typeof node.range === 'undefined') {
                        start = node.left.range[0];
                        end = node.right.range[1];
                        node.range = [start, end];
                    }
                }
                if (loc) {
                    if (node.left.groupLoc || node.right.groupLoc) {
                        start = node.left.groupLoc ? node.left.groupLoc.start : node.left.loc.start;
                        end = node.right.groupLoc ? node.right.groupLoc.end : node.right.loc.end;
                        node.loc = {
                            start: start,
                            end: end
                        };
                    } else if (typeof node.loc === 'undefined') {
                        node.loc = {
                            start: node.left.loc.start,
                            end: node.right.loc.end
                        };
                    }
                }
            }

            return function () {
                var marker, node;

                skipComment();

                marker = createLocationMarker();
                node = parseFunction.apply(null, arguments);
                marker.end();

                if (range && typeof node.range === 'undefined') {
                    marker.apply(node);
                }

                if (loc && typeof node.loc === 'undefined') {
                    marker.apply(node);
                }

                if (isBinary(node)) {
                    visit(node);
                }

                return node;
            };
        };
    }

    function patch() {

        var wrapTracking;

        if (extra.comments) {
            extra.skipComment = skipComment;
            skipComment = scanComment;
        }

        if (extra.raw) {
            extra.createLiteral = createLiteral;
            createLiteral = createRawLiteral;
        }

        if (extra.range || extra.loc) {

            extra.parseGroupExpression = parseGroupExpression;
            extra.parseLeftHandSideExpression = parseLeftHandSideExpression;
            extra.parseLeftHandSideExpressionAllowCall = parseLeftHandSideExpressionAllowCall;
            parseGroupExpression = trackGroupExpression;
            parseLeftHandSideExpression = trackLeftHandSideExpression;
            parseLeftHandSideExpressionAllowCall = trackLeftHandSideExpressionAllowCall;

            wrapTracking = wrapTrackingFunction(extra.range, extra.loc);

            extra.parseAdditiveExpression = parseAdditiveExpression;
            extra.parseAssignmentExpression = parseAssignmentExpression;
            extra.parseBitwiseANDExpression = parseBitwiseANDExpression;
            extra.parseBitwiseORExpression = parseBitwiseORExpression;
            extra.parseBitwiseXORExpression = parseBitwiseXORExpression;
            extra.parseBlock = parseBlock;
            extra.parseFunctionSourceElements = parseFunctionSourceElements;
            extra.parseCatchClause = parseCatchClause;
            extra.parseComputedMember = parseComputedMember;
            extra.parseConditionalExpression = parseConditionalExpression;
            extra.parseConstLetDeclaration = parseConstLetDeclaration;
            extra.parseEqualityExpression = parseEqualityExpression;
            extra.parseExpression = parseExpression;
            extra.parseForVariableDeclaration = parseForVariableDeclaration;
            extra.parseFunctionDeclaration = parseFunctionDeclaration;
            extra.parseFunctionExpression = parseFunctionExpression;
            extra.parseLogicalANDExpression = parseLogicalANDExpression;
            extra.parseLogicalORExpression = parseLogicalORExpression;
            extra.parseMultiplicativeExpression = parseMultiplicativeExpression;
            extra.parseNewExpression = parseNewExpression;
            extra.parseNonComputedProperty = parseNonComputedProperty;
            extra.parseObjectProperty = parseObjectProperty;
            extra.parseObjectPropertyKey = parseObjectPropertyKey;
            extra.parsePostfixExpression = parsePostfixExpression;
            extra.parsePrimaryExpression = parsePrimaryExpression;
            extra.parseProgram = parseProgram;
            extra.parsePropertyFunction = parsePropertyFunction;
            extra.parseRelationalExpression = parseRelationalExpression;
            extra.parseStatement = parseStatement;
            extra.parseShiftExpression = parseShiftExpression;
            extra.parseSwitchCase = parseSwitchCase;
            extra.parseUnaryExpression = parseUnaryExpression;
            extra.parseVariableDeclaration = parseVariableDeclaration;
            extra.parseVariableIdentifier = parseVariableIdentifier;

            parseAdditiveExpression = wrapTracking(extra.parseAdditiveExpression);
            parseAssignmentExpression = wrapTracking(extra.parseAssignmentExpression);
            parseBitwiseANDExpression = wrapTracking(extra.parseBitwiseANDExpression);
            parseBitwiseORExpression = wrapTracking(extra.parseBitwiseORExpression);
            parseBitwiseXORExpression = wrapTracking(extra.parseBitwiseXORExpression);
            parseBlock = wrapTracking(extra.parseBlock);
            parseFunctionSourceElements = wrapTracking(extra.parseFunctionSourceElements);
            parseCatchClause = wrapTracking(extra.parseCatchClause);
            parseComputedMember = wrapTracking(extra.parseComputedMember);
            parseConditionalExpression = wrapTracking(extra.parseConditionalExpression);
            parseConstLetDeclaration = wrapTracking(extra.parseConstLetDeclaration);
            parseEqualityExpression = wrapTracking(extra.parseEqualityExpression);
            parseExpression = wrapTracking(extra.parseExpression);
            parseForVariableDeclaration = wrapTracking(extra.parseForVariableDeclaration);
            parseFunctionDeclaration = wrapTracking(extra.parseFunctionDeclaration);
            parseFunctionExpression = wrapTracking(extra.parseFunctionExpression);
            parseLeftHandSideExpression = wrapTracking(parseLeftHandSideExpression);
            parseLogicalANDExpression = wrapTracking(extra.parseLogicalANDExpression);
            parseLogicalORExpression = wrapTracking(extra.parseLogicalORExpression);
            parseMultiplicativeExpression = wrapTracking(extra.parseMultiplicativeExpression);
            parseNewExpression = wrapTracking(extra.parseNewExpression);
            parseNonComputedProperty = wrapTracking(extra.parseNonComputedProperty);
            parseObjectProperty = wrapTracking(extra.parseObjectProperty);
            parseObjectPropertyKey = wrapTracking(extra.parseObjectPropertyKey);
            parsePostfixExpression = wrapTracking(extra.parsePostfixExpression);
            parsePrimaryExpression = wrapTracking(extra.parsePrimaryExpression);
            parseProgram = wrapTracking(extra.parseProgram);
            parsePropertyFunction = wrapTracking(extra.parsePropertyFunction);
            parseRelationalExpression = wrapTracking(extra.parseRelationalExpression);
            parseStatement = wrapTracking(extra.parseStatement);
            parseShiftExpression = wrapTracking(extra.parseShiftExpression);
            parseSwitchCase = wrapTracking(extra.parseSwitchCase);
            parseUnaryExpression = wrapTracking(extra.parseUnaryExpression);
            parseVariableDeclaration = wrapTracking(extra.parseVariableDeclaration);
            parseVariableIdentifier = wrapTracking(extra.parseVariableIdentifier);
        }

        if (typeof extra.tokens !== 'undefined') {
            extra.advance = advance;
            extra.scanRegExp = scanRegExp;

            advance = collectToken;
            scanRegExp = collectRegex;
        }
    }

    function unpatch() {
        if (typeof extra.skipComment === 'function') {
            skipComment = extra.skipComment;
        }

        if (extra.raw) {
            createLiteral = extra.createLiteral;
        }

        if (extra.range || extra.loc) {
            parseAdditiveExpression = extra.parseAdditiveExpression;
            parseAssignmentExpression = extra.parseAssignmentExpression;
            parseBitwiseANDExpression = extra.parseBitwiseANDExpression;
            parseBitwiseORExpression = extra.parseBitwiseORExpression;
            parseBitwiseXORExpression = extra.parseBitwiseXORExpression;
            parseBlock = extra.parseBlock;
            parseFunctionSourceElements = extra.parseFunctionSourceElements;
            parseCatchClause = extra.parseCatchClause;
            parseComputedMember = extra.parseComputedMember;
            parseConditionalExpression = extra.parseConditionalExpression;
            parseConstLetDeclaration = extra.parseConstLetDeclaration;
            parseEqualityExpression = extra.parseEqualityExpression;
            parseExpression = extra.parseExpression;
            parseForVariableDeclaration = extra.parseForVariableDeclaration;
            parseFunctionDeclaration = extra.parseFunctionDeclaration;
            parseFunctionExpression = extra.parseFunctionExpression;
            parseGroupExpression = extra.parseGroupExpression;
            parseLeftHandSideExpression = extra.parseLeftHandSideExpression;
            parseLeftHandSideExpressionAllowCall = extra.parseLeftHandSideExpressionAllowCall;
            parseLogicalANDExpression = extra.parseLogicalANDExpression;
            parseLogicalORExpression = extra.parseLogicalORExpression;
            parseMultiplicativeExpression = extra.parseMultiplicativeExpression;
            parseNewExpression = extra.parseNewExpression;
            parseNonComputedProperty = extra.parseNonComputedProperty;
            parseObjectProperty = extra.parseObjectProperty;
            parseObjectPropertyKey = extra.parseObjectPropertyKey;
            parsePrimaryExpression = extra.parsePrimaryExpression;
            parsePostfixExpression = extra.parsePostfixExpression;
            parseProgram = extra.parseProgram;
            parsePropertyFunction = extra.parsePropertyFunction;
            parseRelationalExpression = extra.parseRelationalExpression;
            parseStatement = extra.parseStatement;
            parseShiftExpression = extra.parseShiftExpression;
            parseSwitchCase = extra.parseSwitchCase;
            parseUnaryExpression = extra.parseUnaryExpression;
            parseVariableDeclaration = extra.parseVariableDeclaration;
            parseVariableIdentifier = extra.parseVariableIdentifier;
        }

        if (typeof extra.scanRegExp === 'function') {
            advance = extra.advance;
            scanRegExp = extra.scanRegExp;
        }
    }

    function stringToArray(str) {
        var length = str.length,
            result = [],
            i;
        for (i = 0; i < length; ++i) {
            result[i] = str.charAt(i);
        }
        return result;
    }

    function parse(code, options) {
        var program, toString;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        buffer = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false
        };

        extra = {};
        if (typeof options !== 'undefined') {
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;
            extra.raw = (typeof options.raw === 'boolean') && options.raw;
            if (typeof options.tokens === 'boolean' && options.tokens) {
                extra.tokens = [];
            }
            if (typeof options.comment === 'boolean' && options.comment) {
                extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
                extra.errors = [];
            }
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }

                // Force accessing the characters via an array.
                if (typeof source[0] === 'undefined') {
                    source = stringToArray(code);
                }
            }
        }

        patch();
        try {
            program = parseProgram();
            if (typeof extra.comments !== 'undefined') {
                filterCommentLocation();
                program.comments = extra.comments;
            }
            if (typeof extra.tokens !== 'undefined') {
                filterTokenLocation();
                program.tokens = extra.tokens;
            }
            if (typeof extra.errors !== 'undefined') {
                program.errors = extra.errors;
            }
            if (extra.range || extra.loc) {
                program.body = filterGroup(program.body);
            }
        } catch (e) {
            throw e;
        } finally {
            unpatch();
            extra = {};
        }

        return program;
    }

    // Sync with package.json.
    exports.version = '1.0.3';

    exports.parse = parse;

    // Deep copy.
    exports.Syntax = (function () {
        var name, types = {};

        if (typeof Object.create === 'function') {
            types = Object.create(null);
        }

        for (name in Syntax) {
            if (Syntax.hasOwnProperty(name)) {
                types[name] = Syntax[name];
            }
        }

        if (typeof Object.freeze === 'function') {
            Object.freeze(types);
        }

        return types;
    }());

}));
/* vim: set sw=4 ts=4 et tw=80 : */

})()
},{}]},{},[1])
;