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
        var dirtyElements = [];
        var updateTimer;

        ret.magicBindingState = false;
        ret.verbose = false;

        function log(msg, error) {
            if (ret.verbose || error) {
                console.log("[Quick.Engine] " + msg);
            }
        }

        // try to create a renderer backend, currently on DOM supported
        try {
            var renderer = new QuickRendererDOM();
            ret.createElement = renderer.createElement;
            ret.addElement = renderer.addElement;
            ret.addElements = renderer.addElements;
            ret.renderElement = renderer.renderElement;
        } catch (e) {
            log("Cannot create DOM renderer", true);
            ret.createElement = function () {};
            ret.addElements = function () {};
            ret.addElement = function () {};
            ret.renderElement = function () {};
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
        function advance() {
            window.requestAnimFrame(advance);
            var i;
            for (i = 0; i < dirtyElements.length; ++i) {
                dirtyElements[i].render();
            }
            dirtyElements = [];
        }

        advance();

        ret.dirty = function (element, property) {
            element.properties[property].dirty = true;
            if (dirtyElements.indexOf(element) === -1)
                dirtyElements[dirtyElements.length] = element;
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
function Element(id, parent) {
    this.id = id;
    this.element = Quick.Engine.createElement('item', this);
    this.parent = parent;

    this.properties = {};
    this.connections = {};
    this.children = [];
    this.bound = {};

    if (this.parent) {
        this.parent.addChild(this);
    }
}

Element.prototype.addChildren = function (children) {
    for (var j = 0; j < children.length; ++j) {
        var child = children[j];

        // adds child id to the namespace
        this[child.id] = child;

        // adds the parents id to the child
        child[this.id] = this;

        // add child to siblings scope and vice versa
        var i;
        for (i = 0; i < this.children.length; ++i) {
            this.children[i][child.id] = child;
            child[this.children[i].id] = this.children[i];
        }

        // add newly added child to internal children array
        this.children[this.children.length] = child;

        child.parent = this;
    }

    Quick.Engine.addElements(children, this);
}

Element.prototype.addChild = function (child) {
    // adds child id to the namespace
    this[child.id] = child;

    // adds the parents id to the child
    child[this.id] = this;

    // add child to siblings scope and vice versa
    var i;
    for (i = 0; i < this.children.length; ++i) {
        this.children[i][child.id] = child;
        child[this.children[i].id] = this.children[i];
    }

    // add newly added child to internal children array
    this.children[this.children.length] = child;

    child.parent = this;
    Quick.Engine.addElement(child, this);

    return child;
};

Element.prototype.render = function () {
    Quick.Engine.renderElement(this);
};

Element.prototype.addChanged = function (signal, callback) {
    if (!this.connections[signal]) {
        this.connections[signal] = [];
    }

    this.connections[signal][this.connections[signal].length] = callback;
    // console.log("connections for " + signal + " " + this.connections[signal].length);
};

Element.prototype.removeChanged = function (obj, signal) {
    var signalConnections = this.connections[signal];
    // check if there are any connections for this signal
    if (!signalConnections) {
        return;
    }

    for (var i = 0; i < signalConnections.length; ++i) {
        // TODO do implementation
    }
};

Element.prototype.addBinding = function (name, value) {
    // console.log("addBinding", name);

    var that = this;
    var hasBinding = false;

    // FIXME does not catch changing conditions in expression
    //  x: mouseArea.clicked ? a.y() : b:z();
    Quick.Engine.enterMagicBindingState();
    var val = value.apply(this);
    // console.log("addBinding result", name, val);
    var getters = Quick.Engine.exitMagicBindingState();

    // break all previous bindings
    for (var i = 0; i < this.bound[name]; this.bound[name].length) {
        console.log("!!! experimental untested: break binding for " + name);
        var boundObject = this.bound[name][i];
        boundObject.removeChanged(this, name);
    }
    this.bound[name] = [];

    // TODO test break bindings as well!!
    for (var getter in getters) {
        var tmp = getters[getter];
        // store bindings to this for breaking
        this.bound[name][this.bound[name].length] = { element: tmp.element, property: tmp.property };

        tmp.element.addChanged(tmp.property, function() {
            that[name] = value.apply(that);
        });
        hasBinding = true;
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
        handler.apply(that);
    });
}

Element.prototype.addProperty = function (name, value) {
    var that = this;
    var valueStore;

    // register property
    this.properties[name] = {value: value, dirty: false};

    if (this.hasOwnProperty(name)) {
        this.name = value;
    } else {
        Object.defineProperty(this, name, {
            get: function () {
                // console.log("getter: ", that.id, name);
                if (Quick.Engine.magicBindingState)
                    Quick.Engine.addCalledGetter(that, name);

                if (typeof valueStore === 'function')
                    return valueStore.apply(that);

                return valueStore;
            },
            set: function (val) {
                // console.log("setter: ", that.id, name, val);
                if (valueStore === val)
                    return;

                valueStore = val;

                // connections are called like the properties
                that.emit(name);
                Quick.Engine.dirty(that, name);
            }
        });
    }
};

// initial set of all properties and binding evaluation
// should only be called once
Element.prototype.initializeBindings = function () {
    var name, i;
    for (name in this.properties) {
        var value = this.properties[name].value;

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

    for (i = 0; i < this.children.length; ++i) {
        this.children[i].initializeBindings();
    }

    // this calls the onload slot, if defined
    this.emit("load");
};

Element.prototype.emit = function (signal) {
    // console.log("## emit signal " + signal);
    if (signal in this.connections) {
        // console.log("### signal has connections", signal);
        for (var slot in this.connections[signal]) {
            // console.log("#### execute slot", slot);
            this.connections[signal][slot]();
        }
    }
};
