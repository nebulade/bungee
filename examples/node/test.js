var Bungee = require('bungee');
var test = require('./test.jmp.js');

var engine = new Bungee.Engine(new Bungee.RendererDOM());
var app = test(Bungee, engine);

Bungee.jump(engine);
