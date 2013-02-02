// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved
// DOM renderer

"use strict";

/*
 **************************************************
 * Predefined basic elements
 **************************************************
 */
function Item(id, parent) {
    var elem = new Element(id, parent);

    elem.addProperty("-webkit-user-select", "none");
    elem.addProperty("-moz-user-select", "none");
    elem.addProperty("hoverEnabled", false);
    elem.addProperty("mouseAbsX", 0);
    elem.addProperty("mouseAbsY", 0);
    elem.addProperty("mouseRelX", 0);
    elem.addProperty("mouseRelY", 0);
    elem.addProperty("width", 0);
    elem.addProperty("height", 0);
    elem.addProperty("top", 0);
    elem.addProperty("left", 0);
    elem.addProperty("mouseRelStartX", 0);
    elem.addProperty("mouseRelStartY", 0);
    elem.addProperty("mousePressed", false);
    elem.addProperty("containsMouse", false);
    elem.addProperty("scale", 1);
    elem.addProperty("-webkit-transform", function () {
        var s = this.scale.toFixed(4);
        return "scale(" + s + ", " + s + ")";
    });

    return elem;
}

function Text(id, parent) {
    var elem = new Item(id, parent);

    elem.addProperty("font-size", "12pt");
    elem.addProperty("font-family", "Source Code Pro");
    elem.addProperty("text", "");
    elem.addProperty("textWidth", 0);
    elem.addProperty("textHeight", 0);
    elem.addProperty("width", function() { return this.textWidth; });
    elem.addProperty("height", function() { return this.textHeight; });

    // all this below for calculating the text width
    var tmp = window.document.createElement("div");
    document.body.appendChild(tmp);
    tmp.style.position = "absolute";
    tmp.style.visibility = "hidden";
    tmp.style.width = "auto";
    tmp.style.height = "auto";

    elem.addProperty("_text", function () {
        tmp.style["font-size"] = elem["font-size"];
        tmp.style["font-family"] = elem["font-family"];
        tmp.innerText = elem.text;
        elem.textWidth = (tmp.clientWidth + 1);
        elem.textHeight = (tmp.clientHeight + 1);
    });

    return elem;
}

function Rectangle(id, parent) {
    var elem = new Item(id, parent);

    elem.addProperty("background-color", "white");
    elem.addProperty("border-color", "black");
    elem.addProperty("border-style", "solid");
    elem.addProperty("border-width", 1);
    elem.addProperty("border-radius", 0);

    return elem;
}

function Image(id, parent) {
    var elem = new Item(id, parent);

    elem.addProperty("text-align", "center");
    elem.addProperty("src", "image.png");
    elem.addProperty("background-image", function () {
        if (this.src.indexOf("url('") === 0) {
            return this.src;
        }

        return "url('" + this.src + "')";
    });

    return elem;
}

function Button(id, parent) {
    var elem = new Rectangle(id, parent);

    elem.addProperty("text-align", "center");
    elem.addProperty("cursor", "pointer");
    elem.addProperty("background-color", "lightgray");

    return elem;
}

/*
 **************************************************
 * DOM renderer
 **************************************************
 */
function QuickRendererDOM() {

}

QuickRendererDOM.prototype.createElement = function (typeHint, object) {
    var elem;

    if (typeHint === 'object') {
        elem = document.createElement('object');
    } else if (typeHint === 'item') {
        elem = document.createElement('div');
        elem.style.position = 'absolute';
    } else if (typeHint === 'input') {
        elem = document.createElement('input');
    }

    elem.onclick = function () { object.emit('click'); };
    elem.onmouseover = function () {
        if (object.hoverEnabled) {
            object.containsMouse = true;
            object.emit('mouseover');
        }
    };
    elem.onmouseout = function () {
        if (object.hoverEnabled) {
            object.containsMouse = false;
            object.emit('mouseout');
        }
    };
    elem.onmousedown = function (event) {
        object.mousePressed = true;
        object.mouseRelStartX = event.offsetX;
        object.mouseRelStartY = event.offsetY;
        object.emit('mousedown');
    };
    elem.onmouseup = function (event) {
        object.mousePressed = false;
        object.mouseRelStartX = 0;
        object.mouseRelStartY = 0;
        object.emit('mouseup');
    };
    elem.onmousemove = function (event) {
        if (object.hoverEnabled) {
            object.mouseAbsX = event.clientX;
            object.mouseAbsY = event.clientY;
            object.mouseRelX = event.offsetX;
            object.mouseRelY = event.offsetY;
            object.emit('mousemove');
        }
    };

    return elem;
};

QuickRendererDOM.prototype.addElement = function (element, parent) {
    if (parent && parent.element) {
        parent.element.appendChild(element.element);
    } else {
        document.body.appendChild(element.element);
    }
};

QuickRendererDOM.prototype.renderElement = function (element) {
    var name;
    if (element.element) {
        for (name in element.properties) {
            if (name === 'text') {
                element.element.innerHTML = element[name];
            } else {
                element.element.style[name] = element[name];
            }
        }
    }
};
