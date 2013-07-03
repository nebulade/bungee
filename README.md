Bungee.js
=========

Bungee.js is a [declarative](https://en.wikipedia.org/wiki/Declarative_programming) framework to build web applications.
It is heavily inspired by [QML](https://en.wikipedia.org/wiki/QML) and comes with a

* declarative __language__ for describing elements and their relationship between each other
* __compiler__ to JavaScript
* declarative __engine__, which drives the whole application in an event driven fashion

Bungee.js is not a full blown application development framework, it provides mainly an environment
to create the user interface elements. It breaks with the common html/css layouting of objects and relies
on the description how elements should appear on the screen by defining constraints and dynamic bindings.

* **[Introduction](#introduction)**
  * [Installation](#installation)
  * [Run Tests](#run-tests)
  * [Purple World](#purple-world)
  * [Embedded](#embedded)
  * [Precompile](#precompile)

* **[The Language Jump](#the-language-jump)**
  * [Basic Concepts](#basic-concepts)
  * [Creating Elements](#creating-elements)
  * [Using Properties](#using-properties)
  * [Bindings](#bindings)
  * [Custom Elements](#custom-elements)
  * [Delegates](#delegates)

* **[Javascript API](#javascript-api)**
  * [Engine](#engine)
  * [Tokenizer](#tokenizer)
  * [Compiler](#compiler)
  * [DOM Elements](#dom-elements)
  * [Helper](#helper)

* **[Examples](#examples)**


Introduction
------------

This section will get you started in a few minutes.


### Installation

__npm__:

``` sh
  npm install bungee
```

The `npm` package contains modules, the compiler and all the sources. Until there is a stable release,
this is the preferred way to generate the `bungee.js` library together with a minified version:

```
make
```

To pre-compile the additional modules:

```
make modules
```

To remove all generated files:

```
make clean
```

### Run Tests

Currently there are only tokenizer and compiler tests.

```
npm test
```

### Purple World

A very basic purple rectangle example looks like this:

```
Item {
    width: 100
    height: 50
    backgroundColor: "purple"
}
```
Those code snippets can be either embedded into a website and compiled on the client side or pre-compiled
to save some cpu cycles.

### Embedded

Embedding works like having Javascript embedded, only the `type` attribute differs from that.
```
<script type="text/javascript" src="bungee.js"></script>
...
<script type="text/jump">
    Item {
    }
</script>
...
<body onload="Bungee.jump();">
```
The first script tag includes the bungee.js library, followed by a script of type `text/jump` or `text/jmp`
and finally to kick off the compilation as well as the declarative engine, `Bungee.jump()` needs to be called.
In this case in the `onload` handler.

### Precompile

Although embedding the scripts add some more dynamic use cases, it also has major downsides.
The compilation step is really only needed in case the source changes. In addition to that,
since the compiler renders `jump` into Javascript, the generated Javascript code then can be minified offline.

``` sh
cd node_modules/bungee/bin
./bungee foo.jmp foo.jmp.js
```

If you want to have the compiled module namespaced, so all root elements are accessable via
`moduleName.elementId`, pass the `-m Foo` option. To use the module, include it as any other Javascript
file in your HTML alongside the main `bungee.js` library.

```
<script type="text/javascript" src="bungee.js"></script>
<script type="text/javascript" src="foo.jmp.js"></script>

...

<script>
    Bungee.useQueryFlags();
    var ui = Bungee.Foo();
    Bungee.Engine.start();
</script>
```

The Language Jump
-----------------

### Basic Concepts

```
// One line comment
MyElement @ Element {
  property: value-expression;
}

Element {
  id: identifier;
  onproperty: codeline;
  function(argument): {
    codeblock
  }
}
```

The __Jump__ syntax is similar to other languages like CSS or JSON.
The code consists of an element or type definition followed by a block of key-value pairs and child element
definitions.

### Creating Elements

```
Element {
  id: myElement;

  Element {
    id: mySecondElement;
  }

  Element {
  }
}
```

### Using Properties

The key-value pairs have different meanings, depending on the __key__:

* ``foobar``
  Keys, which match a CSS attribute name, will be handled as such. This means that the right
  hand side expression will be assigned to the instantiated element in the fasion of ``obj.style["width"]``.
  Keys, not matching a CSS attribute, are also valid and can be used as custom properties.
* ``onfoobar``
  All keys starting with ``on`` are event handlers for other attributes.
  As a right hand side expression, they take a Javascript code block,
  which will be executed everytime the property, the part after the ``on``,
  in this case ``foobar``, changes. This is useful to react on property changes
  and perform actions, which are hard to express in a declarative way.
* ``foobar(baz)``
  Keys with a function like signature, will create callable functions on the elements.
  Unlike regular properties, those won't be reevaluated everytime a binding inside the function body fires.
  The function argument specification is only convenience and will be simply passed down to the
  compiled Javascript code by the compiler.

```
Element {
  width: 100;
  height: 200;
  borderStyle: "dotted";
  borderWidth: 10;

  weAreDone(msg): {
    console.log(msg);
  }

  onload: this.weAreDone("element created!");
}
```

### Bindings

```
Element {
  width: 100;
  height: this.width * 2;

  Element {
    id: elem
    width: this.parent.height;
    height: this.width;
  }

  Element {
    left: this.parent.left + 20;
    top: this.elem.top + this.elem.height;
    width: 20;
    height: 20;
  }
}
```

### Custom Elements

```
MyGreenSquare @ Element {
  width: 100;
  height: this.width;
  backgroundColor: "#00ff00";
}

MyGreenRectangle @ MyGreenSquare {
  width: 100;
  height: 200;
}

Element {
  id: root

  MyGreenRectangle {
    height: 400;
  }
}
```

### Delegates

```
MyDelegate @ Element {
  width: this.parent.width;
  height: 50;
  backgroundColor: "blue";
}

Element {
  width: 800;
  height: 700;
  foobar: MyDelegate;

  onload: {
    for (var i = 0; i < 10; ++i) {
      var child = this.createfoobar();
      child.modelData = i;
      this.addChild(child);
      child.initializeBindings();
    }
  }
}
```


Javascript API
--------------

### Engine
### Tokenizer
### Compiler
### DOM Elements
### Helper


Examples
--------

There are several examples, on how to use bungee.js in a browser and node environment,
located in the examples subfolder.
