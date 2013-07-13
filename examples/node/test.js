var Bungee = require('../../index.js');
var test = require('./test.jmp.js');

console.log('Bungee:', Bungee);

var engine = new Bungee.Engine(new Bungee.RendererDOM());
console.log('Engine:', engine);

var app = test(Bungee, engine);
console.log(app);

Bungee.jump(engine);
