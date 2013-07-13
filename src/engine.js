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
