"use strict";
var fs = require('fs');
var path = require('path');
var ts = require('typescript');
var compiler_cli_1 = require('@angular/compiler-cli');
var resource_loader_1 = require('./resource_loader');
var utils_1 = require('./utils');
var compiler_host_1 = require('./compiler_host');
var entry_resolver_1 = require('./entry_resolver');
var paths_plugin_1 = require('./paths-plugin');
var AotPlugin = (function () {
    function AotPlugin(options) {
        this._compiler = null;
        this._compilation = null;
        this._typeCheck = true;
        this._skipCodeGeneration = false;
        this._setupOptions(options);
    }
    Object.defineProperty(AotPlugin.prototype, "basePath", {
        get: function () { return this._basePath; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "compilation", {
        get: function () { return this._compilation; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "compilerHost", {
        get: function () { return this._compilerHost; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "compilerOptions", {
        get: function () { return this._compilerOptions; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "done", {
        get: function () { return this._donePromise; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "entryModule", {
        get: function () {
            var splitted = this._entryModule.split('#');
            var path = splitted[0];
            var className = splitted[1] || 'default';
            return { path: path, className: className };
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "genDir", {
        get: function () { return this._genDir; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "program", {
        get: function () { return this._program; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "skipCodeGeneration", {
        get: function () { return this._skipCodeGeneration; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "typeCheck", {
        get: function () { return this._typeCheck; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "i18nFile", {
        get: function () { return this._i18nFile; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "i18nFormat", {
        get: function () { return this._i18nFormat; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AotPlugin.prototype, "locale", {
        get: function () { return this._locale; },
        enumerable: true,
        configurable: true
    });
    AotPlugin.prototype._setupOptions = function (options) {
        // Fill in the missing options.
        if (!options.hasOwnProperty('tsConfigPath')) {
            throw new Error('Must specify "tsConfigPath" in the configuration of @ngtools/webpack.');
        }
        this._tsConfigPath = options.tsConfigPath;
        // Check the base path.
        var maybeBasePath = path.resolve(process.cwd(), this._tsConfigPath);
        var basePath = maybeBasePath;
        if (fs.statSync(maybeBasePath).isFile()) {
            basePath = path.dirname(basePath);
        }
        if (options.hasOwnProperty('basePath')) {
            basePath = path.resolve(process.cwd(), options.basePath);
        }
        var tsConfigJson = null;
        try {
            tsConfigJson = JSON.parse(fs.readFileSync(this._tsConfigPath, 'utf8'));
        }
        catch (err) {
            throw new Error("An error happened while parsing " + this._tsConfigPath + " JSON: " + err + ".");
        }
        var tsConfig = ts.parseJsonConfigFileContent(tsConfigJson, ts.sys, basePath, null, this._tsConfigPath);
        var fileNames = tsConfig.fileNames;
        if (options.hasOwnProperty('exclude')) {
            var exclude = typeof options.exclude == 'string'
                ? [options.exclude] : options.exclude;
            exclude.forEach(function (pattern) {
                var basePathPattern = '(' + basePath.replace(/\\/g, '/')
                    .replace(/[\-\[\]\/{}()+?.\\^$|*]/g, '\\$&') + ')?';
                pattern = pattern
                    .replace(/\\/g, '/')
                    .replace(/[\-\[\]{}()+?.\\^$|]/g, '\\$&')
                    .replace(/\*\*/g, '(?:.*)')
                    .replace(/\*/g, '(?:[^/]*)')
                    .replace(/^/, basePathPattern);
                var re = new RegExp('^' + pattern + '$');
                fileNames = fileNames.filter(function (x) { return !x.replace(/\\/g, '/').match(re); });
            });
        }
        else {
            fileNames = fileNames.filter(function (fileName) { return !/\.spec\.ts$/.test(fileName); });
        }
        this._rootFilePath = fileNames;
        // Check the genDir. We generate a default gendir that's under basepath; it will generate
        // a `node_modules` directory and because of that we don't want TypeScript resolution to
        // resolve to that directory but the real `node_modules`.
        var genDir = path.join(basePath, '$$_gendir');
        this._compilerOptions = tsConfig.options;
        this._angularCompilerOptions = Object.assign({ genDir: genDir }, this._compilerOptions, tsConfig.raw['angularCompilerOptions'], { basePath: basePath });
        if (this._angularCompilerOptions.hasOwnProperty('genDir')) {
            genDir = path.resolve(basePath, this._angularCompilerOptions.genDir);
            this._angularCompilerOptions.genDir = genDir;
        }
        this._basePath = basePath;
        this._genDir = genDir;
        if (options.hasOwnProperty('typeChecking')) {
            this._typeCheck = options.typeChecking;
        }
        if (options.hasOwnProperty('skipCodeGeneration')) {
            this._skipCodeGeneration = options.skipCodeGeneration;
        }
        this._compilerHost = new compiler_host_1.WebpackCompilerHost(this._compilerOptions, this._basePath);
        this._program = ts.createProgram(this._rootFilePath, this._compilerOptions, this._compilerHost);
        if (options.entryModule) {
            this._entryModule = options.entryModule;
        }
        else {
            if (options.mainPath) {
                this._entryModule = entry_resolver_1.resolveEntryModuleFromMain(options.mainPath, this._compilerHost, this._program);
            }
            else {
                this._entryModule = tsConfig.raw['angularCompilerOptions'].entryModule;
            }
        }
        if (options.hasOwnProperty('i18nFile')) {
            this._i18nFile = options.i18nFile;
        }
        if (options.hasOwnProperty('i18nFormat')) {
            this._i18nFormat = options.i18nFormat;
        }
        if (options.hasOwnProperty('locale')) {
            this._locale = options.locale;
        }
    };
    // registration hook for webpack plugin
    AotPlugin.prototype.apply = function (compiler) {
        var _this = this;
        this._compiler = compiler;
        compiler.plugin('context-module-factory', function (cmf) {
            cmf.plugin('before-resolve', function (request, callback) {
                if (!request) {
                    return callback();
                }
                request.request = _this.skipCodeGeneration ? _this.basePath : _this.genDir;
                request.recursive = true;
                request.dependencies.forEach(function (d) { return d.critical = false; });
                return callback(null, request);
            });
            cmf.plugin('after-resolve', function (result, callback) {
                if (!result) {
                    return callback();
                }
                _this.done.then(function () {
                    result.resource = _this.skipCodeGeneration ? _this.basePath : _this.genDir;
                    result.recursive = true;
                    result.dependencies.forEach(function (d) { return d.critical = false; });
                    result.resolveDependencies = utils_1.createResolveDependenciesFromContextMap(function (_, cb) { return cb(null, _this._lazyRoutes); });
                    return callback(null, result);
                }, function () { return callback(null); })
                    .catch(function (err) { return callback(err); });
            });
        });
        compiler.plugin('make', function (compilation, cb) { return _this._make(compilation, cb); });
        compiler.plugin('after-emit', function (compilation, cb) {
            _this._donePromise = null;
            _this._compilation = null;
            compilation._ngToolsWebpackPluginInstance = null;
            cb();
        });
        // Virtual file system.
        compiler.resolvers.normal.plugin('resolve', function (request, cb) {
            if (request.request.match(/\.ts$/)) {
                _this.done.then(function () { return cb(); }, function () { return cb(); });
            }
            else {
                cb();
            }
        });
        compiler.resolvers.normal.apply(new paths_plugin_1.PathsPlugin({
            tsConfigPath: this._tsConfigPath,
            compilerOptions: this._compilerOptions,
            compilerHost: this._compilerHost
        }));
    };
    AotPlugin.prototype._make = function (compilation, cb) {
        var _this = this;
        this._compilation = compilation;
        if (this._compilation._ngToolsWebpackPluginInstance) {
            return cb(new Error('An @ngtools/webpack plugin already exist for this compilation.'));
        }
        this._compilation._ngToolsWebpackPluginInstance = this;
        this._resourceLoader = new resource_loader_1.WebpackResourceLoader(compilation);
        this._donePromise = Promise.resolve()
            .then(function () {
            if (_this._skipCodeGeneration) {
                return;
            }
            // Create the Code Generator.
            return compiler_cli_1.__NGTOOLS_PRIVATE_API_2.codeGen({
                basePath: _this._basePath,
                compilerOptions: _this._compilerOptions,
                program: _this._program,
                host: _this._compilerHost,
                angularCompilerOptions: _this._angularCompilerOptions,
                i18nFile: _this.i18nFile,
                i18nFormat: _this.i18nFormat,
                locale: _this.locale,
                readResource: function (path) { return _this._resourceLoader.get(path); }
            });
        })
            .then(function () {
            // Create a new Program, based on the old one. This will trigger a resolution of all
            // transitive modules, which include files that might just have been generated.
            // This needs to happen after the code generator has been created for generated files
            // to be properly resolved.
            _this._program = ts.createProgram(_this._rootFilePath, _this._compilerOptions, _this._compilerHost, _this._program);
        })
            .then(function () {
            var diagnostics = _this._program.getGlobalDiagnostics();
            if (diagnostics.length > 0) {
                var message = diagnostics
                    .map(function (diagnostic) {
                    var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
                    var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    return diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + "): " + message + ")";
                })
                    .join('\n');
                throw new Error(message);
            }
        })
            .then(function () {
            // Populate the file system cache with the virtual module.
            _this._compilerHost.populateWebpackResolver(_this._compiler.resolvers.normal);
        })
            .then(function () {
            // Process the lazy routes
            _this._lazyRoutes = {};
            var allLazyRoutes = compiler_cli_1.__NGTOOLS_PRIVATE_API_2.listLazyRoutes({
                program: _this._program,
                host: _this._compilerHost,
                angularCompilerOptions: _this._angularCompilerOptions,
                entryModule: _this._entryModule
            });
            Object.keys(allLazyRoutes)
                .forEach(function (k) {
                var lazyRoute = allLazyRoutes[k];
                k = k.split('#')[0];
                if (_this.skipCodeGeneration) {
                    _this._lazyRoutes[k] = lazyRoute;
                }
                else {
                    var lr = path.relative(_this.basePath, lazyRoute.replace(/\.ts$/, '.ngfactory.ts'));
                    _this._lazyRoutes[k + '.ngfactory'] = path.join(_this.genDir, lr);
                }
            });
        })
            .then(function () { return cb(); }, function (err) {
            compilation.errors.push(err);
            cb();
        });
    };
    return AotPlugin;
}());
exports.AotPlugin = AotPlugin;
//# sourceMappingURL=/Users/hans/Sources/angular-cli/packages/@ngtools/webpack/src/plugin.js.map