# statsFilelist

[![npm](https://img.shields.io/npm/v/stats-filelist.svg)](https://www.npmjs.com/package/stats-filelist) [![GitHub issues](https://img.shields.io/github/issues/anseki/stats-filelist.svg)](https://github.com/anseki/stats-filelist/issues) [![dependencies](https://img.shields.io/badge/dependencies-No%20dependency-brightgreen.svg)](package.json) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE-MIT)

Get a list of files and directories with `Stats` of each item. And filter the list with evaluating path, path pattern, type, size, modified time, and more.

By default, statsFilelist gets all files and directories under specific directories recursively, and it returns an Array that includes the expanded [`fs.Stats`](https://nodejs.org/api/fs.html#fs_class_fs_stats) objects of each item.  
That expanded `fs.Stats` object has additional properties such as `fullPath`, `extension`, etc.. (See [`Stats` object](#stats-object).)  
The got `Stats` objects will be useful more than the path list because you are supposed to do something with those files or directories after getting those.

It returns the filtered list if you want. That filter evaluates that `Stats` object by using flexible ways such as RegExp, callback, etc..  
And also, the filter can control the behavior of statsFilelist. For example, it make statsFilelist stop getting files any more when the file you want was found out.

```js
var filelist = require('stats-filelist');

// Asynchronous method:
filelist.get(['dir-1', 'dir-2'], function(list) {
  console.log(list);
}, /\.js$/i); // Get JavaScript files.
// `extension` property also can be used.

// Synchronous method:
var list = filelist.getSync(['dir-1', 'dir-2'],
  function(stats) { return stats.size > 1024; }); // Get 1KB+ files.
console.log(list);
```

## Methods

### `get`, `getSync`

```js
filelist.get(path, callback[, options])
```

```js
filelist.get(path, callback[, filter[, recursive]])
```

```js
list = filelist.getSync(path[, options])
```

```js
list = filelist.getSync(path[, filter[, recursive]])
```

`get` is asynchronous method, and `getSync` is synchronous method.

`path` argument is a string as the path of target directory, or an Array that includes those of multiple target directories. The default value of `path` argument is `.` (i.e. current working directory).

`callback` argument that is specified to `get` method is a function that is called with `list` Array when processing finished. That is same as `list` Array that is returned by `getSync` method.

By default, the `list` Array includes [`Stats` object](#stats-object)s. Also, what it includes can be specified via [`listOf`](#listof) option.

For example:

```js
console.log('File name: ' + list[3].name + ' Updated: ' + list[3].mtime);
```

`options` argument is an Object that has `filter` property, and more. (See [Options](#options).)  
`filter` and `recursive` arguments are same as [`filter`](#filter) and [`recursive`](#options-recursive) option.  
For example, the following 2 codes work same:

```js
filelist.get(path, callback, wanted);
```

```js
filelist.get(path, callback, { filter: wanted });
```

## Options

`options` Object that is passed to the methods can have following properties:

### `filter`

*Type:* RegExp, string or function  
*Default:* `undefined`

By default, the list statsFilelist returns includes all items under specific directories. This option decides whether the list includes each item.  
This can be one of following types:

#### RegExp

If the full path of the current item matches this RegExp, that item is included to the list.

For example, the PNG files are listed ([`extension`](#extension) property of [`Stats` object](#stats-object) also can be used.):

```js
list = filelist.getSync('./media', /\.png$/i);
```

For example, the files and directories except `debug.log` and `package.json` are listed:

```js
list = filelist.getSync('./repo',
  /^(?!.*[\/\\](?:debug\.log|package\.json)$).+$/);
```

For example, the files and directories except files starting with a dot are listed:

```js
list = filelist.getSync('./project', /^(?!.*[\/\\]\.[^\/\\]*$).+$/);
```

For example, the files and directories under `css` directories are listed:

```js
list = filelist.getSync('./websites', /[\/\\]css[\/\\]/i);
```

#### string

If the full path of the current item includes this string, that item is included to the list.  
`/` and `\` are replaced to the platform-specific file separator before this is used. In Windows, the string comparisons are case-insensitive (e.g. it  considers that `file.txt` is included in `FooFile.TXT`).

For example, the files and directories under `node_modules` directories are listed:

```js
list = filelist.getSync('./dev', '/node_modules/');
```

For example, the files and directories starting with a dot are listed:

```js
list = filelist.getSync('./project', '/.');
```

#### function

This function decides whether the current item is included to the list, and also, it can control the behavior of statsFilelist.  
It is called with the [`Stats` object](#stats-object) of the current item.

##### When it returns a boolean

```js
include = filter(stats)
```

If this function returns a `true`, the current item is included to the list. If it returns a `false`, the current item is not included to the list.

For example, the directories are listed:

```js
list = filelist.getSync(null, function(stats) {
  return stats.isDirectory(); // Use `stats.isFile()` if you want files.
});
```

For example, the files and directories that were modified recently are listed:

```js
list = filelist.getSync('./docs', function(stats) {
  return stats.mtime > yesterday;
});
```

For example, the `index.html` files are listed:

```js
list = filelist.getSync('./public_html', function(stats) {
  return stats.name === 'index.html';
});
```

##### When it returns an Object

```js
object = filter(stats)
```

If this function returns an Object, the following properties of this Object decide whether the current item is included to the list, and it controls the behavior of statsFilelist:

###### `include`

If `true` is specified to this property, the current item is included to the list. If `false` is specified to it, the current item is not included to the list.

For example, the files are listed:

```js
list = filelist.getSync(null, function(stats) {
  return {
    include: stats.isFile()
  };
});
```

*If this Object has only `include` property, [that boolean can be returned](#when-it-returns-a-boolean) instead of this Object.*

###### `exit`

If `true` is specified to this property, statsFilelist exits from current directory after processing of current item, and the remaining items in current directory are not processed.  
*Note that the "current directory" means the parent directory of current item, it is not the directory current item points.*  
This is used to finish the method fast.

For example, it does not have to look for the file any more in that directory if it found out `public_html`, because any more `public_html` are clearly not existing under that directory tree:

```js
list = filelist.getSync('./websites', function(stats) {
  return stats.name === 'public_html' ? {
      include: true,
      exit: true
    } : false; // Others are not listed.
});
```

###### `stop`

If `true` is specified to this property, statsFilelist stops getting the items after processing of current item, and it returns the list that includes the items that were added until now, and the all remaining items are not processed.  
This is used to finish the method fast when you want to find out an only one file in the target path.

For example, it does not have to look for the file any more if it found out `foo.py`, because any more `foo.py` are clearly not existing under that project directory tree:

```js
list = filelist.getSync('./project', function(stats) {
  return stats.name === 'foo.py' ? {
      include: true,
      stop: true
    } : false; // Others are not listed.
});
```

###### <a name="filter-recursive"></a>`recursive`

*This is not [`recursive`](#options-recursive) option.*

This property overrides [`recursive`](#options-recursive) option temporarily.  
When the current item is directory, if `true` is specified to this property, statsFilelist gets the items in that directory even if `false` is specified to `recursive` option. If `false` is specified to it, statsFilelist does not get the items in that directory even if `true` is specified to `recursive` option.  
This is used to finish the method fast.

For example, it does not have to list the files and directories in `node_modules` directory:

```js
list = filelist.getSync('./websites', function(stats) {
  return stats.name === 'node_modules' ? {
      include: false,
      recursive: false
    } : true; // Others are listed.
});
```

### <a name="options-recursive"></a>`recursive`

*Type:* boolean  
*Default:* `true`

*This is not [`recursive`](#filter-recursive) property of [`filter`](#filter) option.*

By default, statsFilelist gets all items under specific directories recursively. If `false` is specified to this property, statsFilelist does not get the items in the sub directories.  
This can be controlled on demand by [`recursive`](#filter-recursive) property of [`filter`](#filter) option.

### `clearCache`

*Type:* boolean  
*Default:* `false`

Ever since it is loaded, statsFilelist caches the got [`Stats` object](#stats-object)s to finish the processing fast.  
If you want to clear the cache data to get the newest information such as modified time of the updated files, specify `true` to this option.

### `listOf`

*Type:* string  
*Default:* `undefined`

By default, statsFilelist returns the list of [`Stats` object](#stats-object)s. If the name of property or method of `Stats` object is specified to this option, it returns the list of those values. That is value that was returned by specific method if the name of method is specified.

For example, the list of full paths of each file and directory is returned:

```js
list = filelist.getSync(null, { listOf: 'fullPath' });
```

`list`:

```js
[
  '/path/to/file-1',
  '/path/to/file-2',
  '/path/to/dir-1',
  '/path/to/file-3'
]
```

For example, the list of names of each file and directory is returned:

```js
list = filelist.getSync(null, { listOf: 'name' });
```

`list`:

```js
[
  'file-1',
  'file-2',
  'dir-1',
  'file-3'
]
```

For example, the list of booleans to indicate whether it is file (return value of `isFile` method) of each item is returned:

```js
list = filelist.getSync(null, { listOf: 'isFile' });
```

`list`:

```js
[
  true,
  true,
  false,
  true
]
```

## `Stats` object

The `Stats` object that is evaluated in filter and included to the list that is returned by statsFilelist by default is the expanded [`fs.Stats`](https://nodejs.org/api/fs.html#fs_class_fs_stats) object.  
This has native methods such as `isFile`, `isDirectory`, etc. and native properties such as `mode`, `size`, `mtime`, etc. and following additional properties:

### `path`

The path of the item that was joined to specific target path.

### `fullPath`

The full path of the item.

### `dirPath`

The full path of the parent directory of the item.

### `name`

The name of the item.

### `extension`

The file extension of the item. This does not include `.` as separator.
