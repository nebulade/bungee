Bungee.js
=========

Bungee.js is a declarative framework to build web applications.
It is heavily inspired by QtQuick and comes with a

* declarative __language__ for describing elements and their relationship between each other
* __compiler__ to JavaScript
* declarative __engine__, which drives the whole application in an event driven fashion

Bungee.js is not a full blown application development framework, it provides mainly an environment to create the user interface elements. It breaks with the common html/css layouting of objects and relies on the description how elements should appear on the screen by defining constraints and dynamic bindings.

* **[Introduction](#introduction)**
  * [Installation](#introduction-installation)
  * [Purple World](#introduction-purpleworld)
  * [Embedded](#introduction-embedded)
  * [Precompile](#introduction-precompile)

* **[The language jump](#jump)**
  * [Basic Concepts](#jump-basicconcepts)
  * [Creating Objects](#jump-creatingobjects)
  * [Adding Properties](#jump-addingproperties)
  * [Bindings](#jump-bindings)
  * [Custom Types](#jump-customtypes)
  * [Delegates](#jump-delegates)

* **[Javascript API](#api)**
  * [Engine](#api-engine)
  * [Tokenizer](#api-tokenizer)
  * [Compiler](#api-compiler)
  * [DOM Elements](#api-dom)
  * [Helper](#api-helper)

* **[Examples](#examples)**


Introduction
------------

This section will get you started in a few minutes.


### Installation

__npm__:

``` sh
  npm install bungee
```

The `npm` package contains modules, the compiler and all the sources. Until there is a stable release, this is the preferred way to generate the `bungee.js` library together with a minified version:

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

### Purple World

A very basic purple rectangle example looks like this:

```
Item {
    width: 100
    height: 50
    backgroundColor: "purple"
}
```
Those code snippets can be either embedded into a website and compiled on the client side or pre-compiled to save some cpu cycles.

### Embedded

Embedding works like having Javascript embedded, only the `type` attribute differs from that.
```
<script type="text/javascript" src="bungee.js"></script>
...
<script type="text/jml">
    Item {
    }
</script>
...
<body onload="Bungee.jump();">
```
The first script tag includes the bungee.js library, followed by a script of type `text/jml` and finally to kick off the compilation as well as the declarative engine, `Bungee.jump()` needs to be called. In this case in the `onload` handler.

### Precompile

Although embedding the scripts add some more dynamic use cases, it also has major downsides. The compilation step is really only needed in case the source changes. In addition to that, since the compiler renders `jml` into Javascript, the generated Javascript code then can be minified offline.

``` sh
cd node_modules/bungee/bin
./bungee foo.jml foo.jml.js
```

If you want to have the compiled module namespaced, so all root elements are accessable via `moduleName.elementId`, pass a `-m Foo` option. To use the module, include it as any other Javascript file in your HTML alongside the main `bungee.js` library.

```
<script type="text/javascript" src="bungee.js"></script>
<script type="text/javascript" src="foo.jml.js"></script>

...

<script>
    Bungee.useQueryFlags();
    var ui = Bungee.Foo();
    Bungee.Engine.start();
</script>
```

The language jump
-----------------

### Basic Concepts
### Creating Objects
### Adding Properties
### Bindings
### Custom Types
### Delegates

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
