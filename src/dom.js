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

Quick.BackgroundImage = function (id, parent) {
    var elem = new Quick.Item(id, parent);

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

Quick.Image = function (id, parent) {
    var elem = new Quick.Item(id, parent, "image");

    elem.addProperty("src", "");
    elem.addProperty("-image-src", function () {
        return this.src;
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
    } else if (typeHint === 'image') {
        elem = document.createElement('img');
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
        that.currentScrollElementTopStart = that.currentScrollElement.scrollTop;
        that.currentScrollElementLeftStart = that.currentScrollElement.scrollLeft;
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
