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
if (true){
	doFunctionFoo();
} else {
	console.log("I haven't feature foo!");
}

if (true){
	console.debug("I'm in debug environment");
}
```

## What this stuff doesn't do?

This is not a minifier/compressor. It just inlines constants.

This is not a dead code removal tool. There are some expression computations, but Rhubarb doesn't touch block
statements. I would like to drop `if` branches if the condition was calculated, but found that this
apparently simple feature is actually tricky and error-prone.

## Why not UglifyJS?

UglifyJS2 is a great compression tool with conditional compilation.
Unfortunately, it cannot always guess if expression evaluates constant value.

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

- `options` is an optional object with options:

### Options

#### options.scope

Described the way identifiers are resolved into variables.

- `global` (default) - only global variables (and its properties) are replaced.
- `flat` - variables are replaced everywhere, even if there's a local variables with same name
- `undeclared` - same as `global`, but if a global variable was defined (for example, with `var`), it is skipped
