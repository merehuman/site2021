/*
 * statsFilelist
 * https://github.com/anseki/stats-filelist
 *
 * Copyright (c) 2018 anseki
 * Licensed under the MIT license.
 */

'use strict';

var
  DEFAULT_OPTIONS = {
    filter: true,
    recursive: true,
    clearCache: false,
    listOf: null
  },
  fs = require('fs'),
  pathUtil = require('path'),
  cache = {};

function parseDirEntries(dirPath, filter, options, callback) {

  function parseEntries() {

    function addStats(stats) { // extended stats
      var filterRes = filter(stats); // include, exit, stop, recursive

      if (filterRes.include) {
        list.push(stats);
      }

      if (filterRes.stop) {
        options.stopParse = true;
        process.nextTick(parseEntries);
      } else {
        if (filterRes.exit) { entries = []; }
        if (stats.isDirectory() && filterRes.recursive) {
          parseDirEntries(stats.path, filter, options, function(statsList) {
            list = list.concat(statsList);
            process.nextTick(parseEntries);
          });
        } else {
          process.nextTick(parseEntries);
        }
      }
    }

    var path = entries.shift(), fullPath, stats;

    if (!path || options.stopParse) { // finished
      callback(list);
    } else {
      fullPath = pathUtil.resolve(path);
      if ((stats = path2stats(fullPath))) { // cache
        addStats(stats);
      } else {
        fs.stat(path, function(error, stats) {
          if (error) { throw error; }
          addStats(path2stats(fullPath, stats, path));
        });
      }
    }
  }

  var list = [], entries;

  fs.readdir(dirPath, function(error, nameList) {
    if (error) { throw error; }
    entries = nameList.map(
      function(name) { return pathUtil.join(dirPath, name); });
    process.nextTick(parseEntries);
  });
}

function parseDirEntriesSync(dirPath, filter, options) {
  var list = [], entries = fs.readdirSync(dirPath).map(
    function(name) { return pathUtil.join(dirPath, name); }),
    path, fullPath, stats, filterRes;

  while (true) {
    if (!(path = entries.shift()) || options.stopParse) { // finished
      return(list);
    } else {
      fullPath = pathUtil.resolve(path);
      stats = path2stats(fullPath) || path2stats(fullPath, fs.statSync(path), path);
      filterRes = filter(stats); // include, exit, stop, recursive

      if (filterRes.include) {
        list.push(stats);
      }

      if (filterRes.stop) {
        options.stopParse = true;
      } else {
        if (filterRes.exit) { entries = []; }
        if (stats.isDirectory() && filterRes.recursive) {
          list = list.concat(parseDirEntriesSync(stats.path, filter, options));
        }
      }
    }
  }
}

function path2stats(fullPath, stats, path) {
  if (stats) {
    stats.path = path;
    stats.fullPath = fullPath;
    stats.dirPath = pathUtil.dirname(fullPath);
    stats.name = pathUtil.basename(fullPath);
    stats.extension = pathUtil.extname(fullPath).replace(/^\./, '');
    cache[fullPath] = stats;
  }
  return cache[fullPath];
}

function fixFilter(options) {
  var filter = options.filter, type = typeof filter;
  return (
    filter instanceof RegExp ?
      function(stats) {
        return { include: filter.test(stats.fullPath),
          recursive: options.recursive };
      } :
    type === 'function' ?
      function(stats) {
        var res = filter(stats);
        if (typeof res !== 'object') {
          res = { include: !!res, recursive: options.recursive };
        } else if (typeof res.recursive !== 'boolean') {
          res.recursive = options.recursive;
        }
        return res;
      } :
    type === 'string' ?
      function(stats) {
        var fullPath = stats.fullPath,
          searchValue = filter.replace(/[\/\\]/g, pathUtil.sep);
        if (process.platform === 'win32') {
          fullPath = fullPath.toLowerCase();
          searchValue = searchValue.toLowerCase();
        }
        return { include: fullPath.indexOf(searchValue) > -1,
          recursive: options.recursive };
      } :
    type === 'boolean' ?
      function() { return { include: filter, recursive: options.recursive }; } :
    function() { return { include: true, recursive: options.recursive }; }
  );
}

function addUniqueStats(stats, list, added) {
  (Array.isArray(stats) ? stats : [stats]).forEach(function(stats) {
    if (!added[stats.fullPath]) {
      added[stats.fullPath] = true;
      list.push(stats);
    }
  });
}

function getList(list, listOf) {
  return list.map(function(stats) {
    return typeof stats[listOf] === 'function' ? stats[listOf]() : stats[listOf];
  });
}

function parseArgStartDirs(startDirs) {
  return !startDirs ? ['.'] :
    (Array.isArray(startDirs) ? startDirs : [startDirs])
      .filter(function(dir) { return !!dir; }); // copy
}

function parseArgOptions(index, args) {
  return Object.keys(DEFAULT_OPTIONS).reduce(function(options, optionName) {
      if (typeof options[optionName] === 'undefined') {
        options[optionName] = DEFAULT_OPTIONS[optionName];
      }
      return options;
    },
    args.length - 1 < index ? {} :
    args[index] && typeof args[index] === 'object' &&
      !(args[index] instanceof RegExp) ? args[index] :
    { filter: args[index], recursive: args[index + 1] }
  );
}

// Another args: (startDirs, callback, filter, recursive)
exports.get = function(startDirs, callback, options) {

  function parseDirs() {

    function addStats(stats) { // extended stats
      if (stats.isDirectory()) {
        parseDirEntries(stats.path, filter, options, function(statsList) {
          addUniqueStats(statsList, list, added);
          process.nextTick(parseDirs);
        });
      } else {
        addUniqueStats(stats, list, added);
        process.nextTick(parseDirs);
      }
    }

    var path = startDirs.shift(), fullPath, stats;

    if (!path || options.stopParse) { // finished
      delete options.stopParse; // It might be reused.
      if (typeof callback === 'function') {
        callback(options.listOf ? getList(list, options.listOf) : list);
      }
    } else {
      fullPath = pathUtil.resolve(path);
      if ((stats = path2stats(fullPath))) { // cache
        addStats(stats);
      } else {
        fs.stat(path, function(error, stats) {
          if (error) { throw error; }
          addStats(path2stats(fullPath, stats, path));
        });
      }
    }
  }

  var filter, list = [], added = {};

  startDirs = parseArgStartDirs(startDirs);
  options = parseArgOptions(2, arguments);

  if (options.clearCache) { cache = {}; }
  filter = fixFilter(options);
  delete options.stopParse; // It might be reused.

  process.nextTick(parseDirs);
};

// Another args: (startDirs, filter, recursive)
exports.getSync = function(startDirs, options) {

  var filter, list = [], added = {},
    path, fullPath, stats;

  startDirs = parseArgStartDirs(startDirs);
  options = parseArgOptions(1, arguments);

  if (options.clearCache) { cache = {}; }
  filter = fixFilter(options);
  delete options.stopParse; // It might be reused.

  while (true) {
    if (!(path = startDirs.shift()) || options.stopParse) { // finished
      delete options.stopParse; // It might be reused.
      return options.listOf ? getList(list, options.listOf) : list;
    } else {
      fullPath = pathUtil.resolve(path);
      stats = path2stats(fullPath) || path2stats(fullPath, fs.statSync(path), path);
      addUniqueStats(stats.isDirectory() ?
        parseDirEntriesSync(stats.path, filter, options) : stats, list, added);
    }
  }
};
