# rhubarb
Conditional compilation tool for javascript

_Barbarian way to make custom builds_

## What does it do?

It takes the source code

```javascript
if (Whatever.hasFeature("foo")){
	doFunctionFoo();
} else {
	console.log("I haven't feature foo!");
}

if (__environment !== 'production'){
	console.debug("I'm in debug environment");
}
```

and the state

```javascript
{
	"Whatever": {
		"hasFeature": function(feature){
			if (feature === 'foo'){
				return true;
			}
		}
	},
	"__environment": "Dark basement"
}
```

and returns following:

```javascript
doFunctionFoo();
console.debug("I'm in debug environment");
```

## Why not UglifyJS?

UglifyJS2 is a great compression tool with conditional compilation.
Unfortunately, it cannot always guess if expression have constant value.

This tool can. With your little help.

And you can use functions/methods!

## How to use it?

Currently it only can be used as a module.

There's only one method, `inline` with following signature:

```javascript
require("rhubarb").inline(code, state [, options]);
```

- `code` is a javascript code.

- `state` is an object that is used as global.
If state has _(`in` javascript operator is used)_ value, it is used for replacement.
If it hasn't, code stays the same.

- `options` is an object with options:

### Options

#### options.scope

Described the way identifiers are resolved into variables.

- `global` (default) - only global variables (and its properties) are replaced.
- `flat` - variables are replaced everywhere, even if there's a local variables with same name
- `undeclared` - same as `global`, but if a global variable was defined (for example, with `var`), it is skipped


## Status

Currently in development. Do not try to use it yet.

Roadmap:

- [x] Make builtin js objects usable (`Math`, `Object`, etc.)
- [x] Globals reference (`window`, `global`, `self`, custom?)
- [ ] Make a fake-global object accessor
- [ ] Add more options
- [x] Write tests
- [ ] Write docs
- [ ] Make a CLI
- [ ] Publish on NPM
- [ ] Show warnings
