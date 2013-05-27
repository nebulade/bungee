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
        var renderInterval;
        var fps = {};
        fps.d = Date.now();
        fps.l = 0;

        function advance() {
            for (var i in _dirtyElements) {
                _dirtyElements[i].render();
            }
            _dirtyElements = {};

            if (Quick.verbose) {
                if ((Date.now() - fps.d) >= 2000) {
                    console.log("FPS: " + fps.l / 2.0);
                    fps.d = Date.now();
                    fps.l = 0;
                } else {
                    ++(fps.l);
                }
            }
        }

        ret.start = function () {
            renderInterval = window.setInterval(advance, 1000/60.0);
            advance();
        };

        ret.stop = function () {
            window.clearInterval(renderInterval);
        };

        ret.dirty = function (element, property) {
            // ignore properties prefixed with _
            if (property[0] === '_') {
                return;
            }

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
    this._initializeBindingsStep = false;

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
        if (!that._initializeBindingsStep)
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

    if (!this.hasOwnProperty(name)) {
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
Quick.Element.prototype.initializeBindings = function (options) {
    var name, i;

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

Quick.Element.prototype.emit = function (signal) {
    if (signal in this._connections) {
        var slots = this._connections[signal];
        for (var slot in slots) {
            if (slots.hasOwnProperty(slot)) {
                slots[slot].apply();
            }
        }
    }
};
