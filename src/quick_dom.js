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

    elem.addProperty("-webkit-user-select", "none");
    elem.addProperty("userSelect", "none");
    elem.addProperty("hoverEnabled", false);
    elem.addProperty("mouseAbsX", 0);
    elem.addProperty("mouseAbsY", 0);
    elem.addProperty("mouseRelX", 0);
    elem.addProperty("mouseRelY", 0);
    elem.addProperty("width", 100);
    elem.addProperty("height", 100);
    elem.addProperty("top", 0);
    elem.addProperty("bottom", function () { return this.top + this.height; });
    elem.addProperty("verticalCenter", function () { return this.height / 2.0; });
    elem.addProperty("left", 0);
    elem.addProperty("right", function () { return this.left + this.width; });
    elem.addProperty("horizontalCenter", function () { return this.width / 2.0; });
    elem.addProperty("mouseRelStartX", 0);
    elem.addProperty("mouseRelStartY", 0);
    elem.addProperty("mousePressed", false);
    elem.addProperty("containsMouse", false);
    elem.addProperty("scale", 1);
    elem.addProperty("opacity", 1);
    elem.addProperty("-webkit-transform", function () {
        var s = this.scale.toFixed(10);
        return "scale(" + s + ", " + s + ")";
    });
    elem.addProperty("transform", function () {
        var s = this.scale.toFixed(10);
        return "scale(" + s + ", " + s + ")";
    });
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

// FIXME global leak
var tmpTextElement;
Quick.Text = function (id, parent) {
    var elem = new Quick.Item(id, parent);

    elem.addProperty("textWidth", 0);
    elem.addProperty("textHeight", 0);
    elem.addProperty("fontSize", "12pt");
    elem.addProperty("fontFamily", "Source Code Pro");
    elem.addProperty("text", "");
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

    elem.addChanged("text", function () {
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
    });

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

Quick.Button = function (id, parent) {
    var elem = new Quick.Item(id, parent);

    elem.addProperty("textAlign", "center");
    elem.addProperty("cursor", "pointer");
    elem.addProperty("backgroundColor", "lightgray");

    return elem;
};

Quick.Input = function (id, parent) {
    var elem = new Quick.Item(id, parent, "input");

    elem.addProperty("-webkit-user-select", "auto");
    elem.addProperty("userSelect", "auto");
    elem.addProperty("hoverEnabled", true);
    elem.addProperty("fontSize", "12pt");
    elem.addProperty("fontFamily", "Source Code Pro");
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

};

Quick.RendererDOM.prototype.createElement = function (typeHint, object) {
    var elem;

    if (typeHint === 'input') {
        elem = document.createElement('input');
    } else {
        elem = document.createElement('div');
        elem.style.position = 'absolute';
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
        object.mouseRelStartX = event.layerX;
        object.mouseRelStartY = event.layerY;
        object.emit('mousedown');
    };
    elem.onmouseup = function (event) {
        object.mousePressed = false;
        object.mouseRelStartX = 0;
        object.mouseRelStartY = 0;
        object.emit('mouseup');
    };
    elem.ontouchstart = function (event) {
        object.mousePressed = true;
        object.emit('mousedown');
    };
    elem.ontouchend = function (event) {
        object.mousePressed = false;
        object.mouseRelStartX = 0;
        object.mouseRelStartY = 0;
        object.emit('mouseup');
    };
    elem.onmousemove = function (event) {
        if (object.hoverEnabled) {
            object.mouseAbsX = event.clientX;
            object.mouseAbsY = event.clientY;
            object.mouseRelX = event.layerX;
            object.mouseRelY = event.layerY;
            object.emit('mousemove');
        }
    };

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
        if (name === 'text') {
            element.element.innerHTML = element[name];
        } else if (name === 'placeholder') {
            element.element.placeholder = element[name];
        } else {
            element.element.style[name] = element[name];
        }
    }
    element._dirtyProperties = {};
};
